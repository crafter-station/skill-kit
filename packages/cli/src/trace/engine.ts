import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

export interface ToolCall {
	name: string;
	input: Record<string, unknown>;
	timestampMs: number;
}

export interface TraceResult {
	traceId: string;
	skillName: string | null;
	prompt: string;
	response: string;
	toolCalls: ToolCall[];
	filesRead: string[];
	tokensIn: number;
	tokensOut: number;
	tokensTotal: number;
	cacheCreationTokens: number;
	cacheReadTokens: number;
	durationMs: number;
	costEstimate: number;
	model: string;
	timestamp: string;
}

interface TraceOptions {
	prompt: string;
	skillPath?: string;
	model?: string;
	timeout?: number;
	debug?: boolean;
	disableSkills?: boolean;
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
	"claude-opus-4-6": { input: 15 / 1_000_000, output: 75 / 1_000_000 },
	"claude-sonnet-4-6": { input: 3 / 1_000_000, output: 15 / 1_000_000 },
	"claude-haiku-4-5": { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
};

function estimateCost(
	model: string,
	tokensIn: number,
	tokensOut: number,
): number {
	for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
		if (model.includes(key) || key.includes(model)) {
			return tokensIn * pricing.input + tokensOut * pricing.output;
		}
	}
	return tokensIn * (3 / 1_000_000) + tokensOut * (15 / 1_000_000);
}

function findProjectRoot(): string {
	let current = process.cwd();
	const { root } = require("node:path").parse(current);
	while (current !== root) {
		try {
			const stat = require("node:fs").statSync(join(current, ".claude"));
			if (stat.isDirectory()) return current;
		} catch {}
		current = require("node:path").dirname(current);
	}
	return process.cwd();
}

function createTempCommand(
	skillName: string,
	description: string,
	projectRoot: string,
): { path: string; cleanName: string } {
	const id = Math.random().toString(36).slice(2, 10);
	const cleanName = `${skillName}-trace-${id}`;
	const commandsDir = join(projectRoot, ".claude", "commands");
	mkdirSync(commandsDir, { recursive: true });
	const filePath = join(commandsDir, `${cleanName}.md`);
	const indented = description.split("\n").join("\n  ");
	writeFileSync(
		filePath,
		`---\ndescription: |\n  ${indented}\n---\n\n# ${skillName}\n\nThis skill handles: ${description}\n`,
	);
	return { path: filePath, cleanName };
}

function cleanupTempCommand(path: string): void {
	try {
		rmSync(path);
	} catch {}
}

export async function runTrace(options: TraceOptions): Promise<TraceResult> {
	const { prompt, model, timeout = 120, debug = false } = options;
	const startTime = Date.now();
	const traceId = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

	const cmd = ["claude", "-p", prompt, "--output-format", "stream-json", "--verbose"];
	if (model) cmd.push("--model", model);
	if (options.disableSkills) cmd.push("--disable-slash-commands");

	const env: Record<string, string> = {};
	for (const [k, v] of Object.entries(process.env)) {
		if (k !== "CLAUDECODE" && v !== undefined) env[k] = v;
	}

	const child = spawn(cmd[0]!, cmd.slice(1), {
		stdio: ["ignore", "pipe", "ignore"],
		env,
	}) as import("node:child_process").ChildProcess;

	const toolCalls: ToolCall[] = [];
	const filesRead: string[] = [];
	let skillName: string | null = null;
	let tokensIn = 0;
	let tokensOut = 0;
	let tokensTotal = 0;
	let cacheCreationTokens = 0;
	let cacheReadTokens = 0;
	let detectedModel = model ?? "claude-sonnet-4-6";
	let costFromApi = 0;
	let response = "";

	let pendingToolName: string | null = null;
	let accumulatedJson = "";

	const timeoutId = setTimeout(() => {
		child.kill("SIGTERM");
	}, timeout * 1000);

	return new Promise<TraceResult>((resolve, reject) => {
		const rl = createInterface({ input: child.stdout! });

		rl.on("line", (line) => {
			const trimmed = line.trim();
			if (!trimmed) return;

			let event: Record<string, unknown>;
			try {
				event = JSON.parse(trimmed);
			} catch {
				return;
			}

			if (debug) {
				const keys = Object.keys(event).join(", ");
				process.stderr.write(`[trace-debug] type=${event.type as string} keys=${keys}\n`);
				if (event.type === "result") {
					process.stderr.write(`[trace-debug] result=${JSON.stringify(event).slice(0, 500)}\n`);
				}
			}

			if (event.type === "stream_event") {
				const se = event.event as Record<string, unknown> | undefined;
				if (!se) return;
				const seType = se.type as string;

				if (seType === "content_block_start") {
					const cb = se.content_block as Record<string, unknown> | undefined;
					if (cb?.type === "tool_use") {
						pendingToolName = cb.name as string;
						accumulatedJson = "";
					}
				} else if (seType === "content_block_delta" && pendingToolName) {
					const delta = se.delta as Record<string, unknown> | undefined;
					if (delta?.type === "input_json_delta") {
						accumulatedJson += (delta.partial_json as string) ?? "";
					}
				} else if (seType === "content_block_stop" && pendingToolName) {
					let input: Record<string, unknown> = {};
					try {
						input = JSON.parse(accumulatedJson);
					} catch {}

					const call: ToolCall = {
						name: pendingToolName,
						input,
						timestampMs: Date.now() - startTime,
					};
					toolCalls.push(call);

					if (pendingToolName === "Skill") {
						const s =
							(input.skill as string) ??
							(input.name as string) ??
							(input.skillName as string);
						if (s) skillName = s;
					} else if (pendingToolName === "Read") {
						const fp = input.file_path as string;
						if (fp) filesRead.push(fp);
					}

					pendingToolName = null;
					accumulatedJson = "";
				}
			} else if (event.type === "assistant") {
				const message = event.message as Record<string, unknown> | undefined;
				const content = message?.content as Array<Record<string, unknown>> | undefined;
				if (!content) return;
				for (const item of content) {
					if (item.type !== "tool_use") continue;
					const name = item.name as string;
					const input = (item.input as Record<string, unknown>) ?? {};

					const call: ToolCall = {
						name,
						input,
						timestampMs: Date.now() - startTime,
					};
					if (!toolCalls.some((tc) => tc.name === name && tc.timestampMs === call.timestampMs)) {
						toolCalls.push(call);
					}

					if (name === "Skill") {
						const s =
							(input.skill as string) ??
							(input.name as string) ??
							(input.skillName as string);
						if (s) skillName = s;
					} else if (name === "Read") {
						const fp = input.file_path as string;
						if (fp && !filesRead.includes(fp)) filesRead.push(fp);
					}
				}
			} else if (event.type === "result") {
				const result = event as Record<string, unknown>;
				const usage = result.usage as Record<string, unknown> | undefined;
				if (usage) {
					tokensIn = (usage.input_tokens as number) ?? 0;
					cacheCreationTokens = (usage.cache_creation_input_tokens as number) ?? 0;
					cacheReadTokens = (usage.cache_read_input_tokens as number) ?? 0;
					tokensOut = (usage.output_tokens as number) ?? 0;
					tokensTotal = tokensIn + tokensOut;
				}
				if (result.duration_ms) {
					// prefer API-reported duration
				}
				if (result.total_cost_usd) {
					costFromApi = result.total_cost_usd as number;
				}
				if (result.model) detectedModel = result.model as string;
				if (result.result) response = result.result as string;
			}
		});

		child.on("close", () => {
			clearTimeout(timeoutId);
			const durationMs = Date.now() - startTime;
			const cost = costFromApi > 0 ? costFromApi : estimateCost(detectedModel, tokensIn, tokensOut);

			resolve({
				traceId,
				skillName,
				prompt,
				response,
				toolCalls,
				filesRead,
				tokensIn,
				tokensOut,
				tokensTotal: tokensTotal || tokensIn + tokensOut,
				cacheCreationTokens,
				cacheReadTokens,
				durationMs,
				costEstimate: cost,
				model: detectedModel,
				timestamp: new Date().toISOString(),
			});
		});

		child.on("error", (err: Error) => {
			clearTimeout(timeoutId);
			reject(new Error(`Failed to spawn claude: ${err.message}`));
		});
	});
}
