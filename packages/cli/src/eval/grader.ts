import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { TraceResult } from "../trace/engine";

export interface GradeResult {
	expectation: string;
	passed: boolean;
	evidence: string;
}

export interface EvalGrade {
	evalId: number;
	prompt: string;
	grades: GradeResult[];
	passed: number;
	failed: number;
	total: number;
	passRate: number;
	trace: TraceResult;
}

export async function gradeExpectations(
	expectations: string[],
	trace: TraceResult,
	expectedOutput: string,
): Promise<GradeResult[]> {
	if (expectations.length === 0) return [];

	const transcript = buildTranscript(trace);
	const results: GradeResult[] = [];

	for (const expectation of expectations) {
		const programmatic = tryProgrammaticGrade(expectation, trace);
		if (programmatic) {
			results.push(programmatic);
			continue;
		}

		const llmResult = await llmGrade(expectation, transcript, expectedOutput);
		results.push(llmResult);
	}

	return results;
}

function buildTranscript(trace: TraceResult): string {
	const lines: string[] = [];
	lines.push(`Prompt: ${trace.prompt}`);
	lines.push(`Skill fired: ${trace.skillName ?? "(none)"}`);
	lines.push(`Duration: ${trace.durationMs}ms`);
	lines.push(`Model: ${trace.model}`);
	lines.push(`Tokens: ${trace.tokensTotal} (in: ${trace.tokensIn}, out: ${trace.tokensOut})`);
	lines.push(`Cache: ${trace.cacheCreationTokens} created, ${trace.cacheReadTokens} read`);
	lines.push(`Cost: $${trace.costEstimate.toFixed(4)}`);
	lines.push("");
	lines.push("Tool calls:");
	for (const tc of trace.toolCalls) {
		const inputStr = JSON.stringify(tc.input).slice(0, 200);
		lines.push(`  ${tc.name}: ${inputStr}`);
	}
	lines.push("");
	lines.push("Files read:");
	for (const fp of trace.filesRead) {
		lines.push(`  ${fp}`);
	}
	if (trace.response) {
		lines.push("");
		lines.push("Response:");
		lines.push(`  ${trace.response.slice(0, 2000)}`);
	}
	return lines.join("\n");
}

function tryProgrammaticGrade(
	expectation: string,
	trace: TraceResult,
): GradeResult | null {
	const lower = expectation.toLowerCase();

	if (lower.includes("no skill should fire") || lower.includes("no skill should trigger") || lower.includes("no skill should activate")) {
		const passed = trace.skillName === null;
		return {
			expectation,
			passed,
			evidence: passed
				? "No skill was fired"
				: `Expected no skill to fire, but "${trace.skillName}" was fired`,
		};
	}

	if (lower.includes("should not fire") || lower.includes("should not trigger") || lower.includes("should not activate")) {
		const skillNames = extractQuotedStrings(expectation);
		if (skillNames.length > 0) {
			const forbidden = skillNames[0]!.toLowerCase();
			const actual = trace.skillName?.toLowerCase() ?? "";
			const fired = actual !== "" && (actual.includes(forbidden) || forbidden.includes(actual));
			return {
				expectation,
				passed: !fired,
				evidence: !fired
					? `Skill "${skillNames[0]}" was not fired (got: "${trace.skillName ?? "(none)"}")`
					: `Skill "${trace.skillName}" was fired but should not have been`,
			};
		}
	}

	if (lower.includes("tool") && (lower.includes("should not be called") || lower.includes("should not be used") || lower.includes("should not be invoked"))) {
		const toolNames = extractQuotedStrings(expectation);
		if (toolNames.length > 0) {
			const forbidden = toolNames[0]!;
			const found = trace.toolCalls.some(
				(tc) => tc.name.toLowerCase() === forbidden.toLowerCase(),
			);
			return {
				expectation,
				passed: !found,
				evidence: !found
					? `Tool "${forbidden}" was not called`
					: `Tool "${forbidden}" was called but should not have been`,
			};
		}
	}

	if (lower.includes("skill") && (lower.includes("fired") || lower.includes("triggered") || lower.includes("activated"))) {
		const skillNames = extractQuotedStrings(expectation);
		if (skillNames.length > 0) {
			const expected = skillNames[0]!.toLowerCase();
			const actual = trace.skillName?.toLowerCase() ?? "";
			const passed = actual !== "" && (actual.includes(expected) || expected.includes(actual));
			return {
				expectation,
				passed,
				evidence: passed
					? `Skill "${trace.skillName}" was fired`
					: `Expected skill containing "${skillNames[0]}", got "${trace.skillName ?? "(none)"}"`,
			};
		}
	}

	if (lower.includes("tool") && (lower.includes("called") || lower.includes("used") || lower.includes("invoked"))) {
		const toolNames = extractQuotedStrings(expectation);
		if (toolNames.length > 0) {
			const expected = toolNames[0]!;
			const found = trace.toolCalls.some(
				(tc) => tc.name.toLowerCase() === expected.toLowerCase(),
			);
			return {
				expectation,
				passed: found,
				evidence: found
					? `Tool "${expected}" was called`
					: `Tool "${expected}" was not found in ${trace.toolCalls.length} tool calls`,
			};
		}
	}

	if (lower.includes("file") && lower.includes("read")) {
		const paths = extractQuotedStrings(expectation);
		if (paths.length > 0) {
			const expected = paths[0]!;
			const found = trace.filesRead.some(
				(fp) => fp.includes(expected) || expected.includes(fp.split("/").pop() ?? ""),
			);
			return {
				expectation,
				passed: found,
				evidence: found
					? `File matching "${expected}" was read`
					: `No file matching "${expected}" in ${trace.filesRead.length} files read`,
			};
		}
	}

	if (lower.includes("tokens") && (lower.includes("less than") || lower.includes("under") || lower.includes("<"))) {
		const nums = expectation.match(/(\d[\d,]*)/g);
		if (nums) {
			const threshold = parseInt(nums[nums.length - 1]!.replace(/,/g, ""), 10);
			const passed = trace.tokensTotal < threshold;
			return {
				expectation,
				passed,
				evidence: `Total tokens: ${trace.tokensTotal} (threshold: ${threshold})`,
			};
		}
	}

	return null;
}

function extractQuotedStrings(text: string): string[] {
	const matches = text.match(/["']([^"']+)["']/g);
	if (!matches) return [];
	return matches.map((m) => m.slice(1, -1));
}

async function llmGrade(
	expectation: string,
	transcript: string,
	expectedOutput: string,
): Promise<GradeResult> {
	const prompt = `You are a grader evaluating whether an AI agent's execution meets an expectation.

TRANSCRIPT:
${transcript}

EXPECTED OUTPUT DESCRIPTION:
${expectedOutput}

EXPECTATION TO EVALUATE:
${expectation}

Does the transcript show that this expectation was met? Respond with EXACTLY this JSON format:
{"passed": true/false, "evidence": "brief explanation"}`;

	try {
		const result = await runClaudeGrader(prompt);
		return { expectation, ...result };
	} catch {
		return {
			expectation,
			passed: false,
			evidence: "LLM grading failed — marking as failed",
		};
	}
}

async function runClaudeGrader(
	prompt: string,
): Promise<{ passed: boolean; evidence: string }> {
	const env: Record<string, string> = {};
	for (const [k, v] of Object.entries(process.env)) {
		if (k !== "CLAUDECODE" && v !== undefined) env[k] = v;
	}

	const child = spawn(
		"claude",
		["-p", prompt, "--model", "claude-haiku-4-5", "--output-format", "json"],
		{ stdio: ["ignore", "pipe", "ignore"], env },
	);

	let output = "";
	const rl = createInterface({ input: child.stdout! });

	return new Promise((resolve, reject) => {
		let timer: ReturnType<typeof setTimeout>;
		rl.on("line", (line) => {
			output += line;
		});

		child.on("close", () => {
			clearTimeout(timer);
			try {
				const outer = JSON.parse(output);
				const inner = typeof outer === "object" && outer !== null && "result" in outer
					? (outer as Record<string, unknown>).result
					: outer;
				let data: Record<string, unknown>;
				if (typeof inner === "string") {
					const jsonMatch = inner.match(/\{[\s\S]*\}/);
					data = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(inner);
				} else {
					data = inner as Record<string, unknown>;
				}
				resolve({
					passed: Boolean(data.passed),
					evidence: String(data.evidence ?? ""),
				});
			} catch {
				const passMatch = output.match(/"passed"\s*:\s*(true|false)/);
				if (passMatch) {
					resolve({
						passed: passMatch[1] === "true",
						evidence: output.slice(0, 200),
					});
				} else {
					reject(new Error("Could not parse grader output"));
				}
			}
		});

		child.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});

		timer = setTimeout(() => {
			child.kill("SIGTERM");
			reject(new Error("Grader timed out"));
		}, 60_000);
	});
}
