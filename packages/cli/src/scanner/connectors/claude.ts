import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { Invocation } from "../index";
import { recordNewInvocations } from "../index";

interface ToolUseBlock {
	type: "tool_use";
	name: string;
	input: Record<string, unknown>;
}

function extractSkillName(block: ToolUseBlock): string | null {
	const input = block.input;
	if (typeof input.skill === "string") return input.skill;
	if (typeof input.name === "string") return input.name;
	if (typeof input.skillName === "string") return input.skillName;
	return null;
}

export function parseSessionFile(filePath: string): Invocation[] {
	const results: Invocation[] = [];
	const sessionId = basename(filePath, ".jsonl");

	let content: string;
	try {
		content = readFileSync(filePath, "utf-8");
	} catch {
		return results;
	}

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

		const msg = obj.message as
			| { content: Array<Record<string, unknown>> }
			| undefined;
		const msgContent = obj.type === "assistant" && msg ? msg.content : null;

		if (!Array.isArray(msgContent)) continue;

		for (const block of msgContent) {
			if (
				typeof block === "object" &&
				block !== null &&
				block.type === "tool_use" &&
				(block as unknown as ToolUseBlock).name === "Skill"
			) {
				const skillName = extractSkillName(block as unknown as ToolUseBlock);
				if (skillName) {
					results.push({ skillName, timestamp, sessionId });
				}
			}
		}
	}

	return results;
}

export function countClaudeSessions(): number {
	const projectsDir = join(homedir(), ".claude", "projects");
	if (!existsSync(projectsDir)) return 0;

	let count = 0;
	const glob = new Bun.Glob("**/*.jsonl");
	for (const _ of glob.scanSync({ cwd: projectsDir })) {
		count++;
	}
	return count;
}

export async function scanClaudeSessions(
	db: Database,
	trackedSet: Set<string>,
): Promise<number> {
	const projectsDir = join(homedir(), ".claude", "projects");
	if (!existsSync(projectsDir)) return 0;

	const glob = new Bun.Glob("**/*.jsonl");
	const files: string[] = [];

	for await (const file of glob.scan({ cwd: projectsDir, absolute: true })) {
		files.push(file);
	}

	let total = 0;
	for (const file of files) {
		const invocations = parseSessionFile(file);
		total += recordNewInvocations(db, trackedSet, invocations);
	}

	return total;
}
