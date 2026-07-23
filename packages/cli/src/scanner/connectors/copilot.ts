import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { ProgressReporter } from "../../tui/progress";
import type { Invocation } from "../index";
import { recordNewInvocations } from "../index";
import type { ScanCache } from "../scan-cache";

const COPILOT_INTERNAL_TOOLS = new Set([
	"skill",
	"bash",
	"shell",
	"str_replace_editor",
	"view",
	"write",
	"edit",
	"create",
	"grep",
	"glob",
	"fetch",
	"web_search",
	"read_file",
	"write_file",
	"list_dir",
	"report_intent",
	"update_todo",
	"sql",
	"task",
]);

function isInternalTool(name: string): boolean {
	return (
		COPILOT_INTERNAL_TOOLS.has(name) ||
		name.startsWith("mcp__") ||
		name.startsWith("mcp_") ||
		name.startsWith("github-")
	);
}

const SKILL_PATH_RE = /skills\/([^/]+)\/SKILL\.md/;

function extractSkillFromArgs(args: string): string | null {
	const match = SKILL_PATH_RE.exec(args);
	return match ? match[1] : null;
}

export function parseCopilotSessionFile(
	filePath: string,
	knownSkills: Set<string> = new Set(),
): Invocation[] {
	const results: Invocation[] = [];
	const sessionId = `copilot:${basename(dirname(filePath))}`;
	const seenSkills = new Set<string>();

	let content: string;
	try {
		content = readFileSync(filePath, "utf-8");
	} catch {
		return results;
	}

	const push = (skillName: string, timestamp: string) => {
		if (seenSkills.has(skillName)) return;
		seenSkills.add(skillName);
		results.push({ skillName, timestamp, sessionId, agent: "copilot" });
	};

	const lines = content.split("\n");
	for (const line of lines) {
		if (!line.trim()) continue;
		let entry: unknown;
		try {
			entry = JSON.parse(line);
		} catch {
			continue;
		}

		if (typeof entry !== "object" || entry === null) continue;
		const obj = entry as Record<string, unknown>;

		const timestamp =
			typeof obj.timestamp === "string"
				? obj.timestamp
				: new Date().toISOString();
		const type = obj.type as string | undefined;
		const data = obj.data as Record<string, unknown> | undefined;
		if (!data) continue;

		if (type === "skill.invoked") {
			const name = data.name as string | undefined;
			if (name) push(name, timestamp);
			continue;
		}

		if (type === "tool.execution_start") {
			const toolName = data.toolName as string | undefined;
			if (!toolName) continue;

			const args = data.arguments as Record<string, unknown> | undefined;

			if (toolName === "skill") {
				const name = args?.skill as string | undefined;
				if (name) push(name, timestamp);
				continue;
			}

			if (args !== undefined) {
				let serialized: string;
				try {
					serialized = JSON.stringify(args);
				} catch {
					serialized = "";
				}
				const fromPath = extractSkillFromArgs(serialized);
				if (fromPath) {
					push(fromPath, timestamp);
					continue;
				}
			}

			if (isInternalTool(toolName)) continue;
			if (knownSkills.has(toolName)) {
				results.push({
					skillName: toolName,
					timestamp,
					sessionId,
					agent: "copilot",
				});
			}
		}
	}

	return results;
}

export function countCopilotSessions(): number {
	const stateDir = join(homedir(), ".copilot", "session-state");
	if (!existsSync(stateDir)) return 0;

	let count = 0;
	const glob = new Bun.Glob("*/events.jsonl");
	for (const _ of glob.scanSync({ cwd: stateDir })) {
		count++;
	}
	return count;
}

export async function scanCopilotSessions(
	db: Database,
	trackedSet: Set<string>,
	knownSkills: Set<string> = new Set(),
	cache?: ScanCache,
	progress?: ProgressReporter,
): Promise<number> {
	const stateDir = join(homedir(), ".copilot", "session-state");
	if (!existsSync(stateDir)) return 0;

	const glob = new Bun.Glob("*/events.jsonl");
	const files: string[] = [];
	for await (const file of glob.scan({ cwd: stateDir, absolute: true })) {
		files.push(file);
	}

	let total = 0;
	let done = 0;
	for (const file of files) {
		done++;
		if (cache?.shouldSkip(file)) {
			progress?.update(done, files.length);
			continue;
		}
		const invocations = parseCopilotSessionFile(file, knownSkills);
		total += recordNewInvocations(db, trackedSet, invocations);
		progress?.update(done, files.length);
	}
	progress?.finish();

	return total;
}
