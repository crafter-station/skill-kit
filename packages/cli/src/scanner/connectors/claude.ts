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

const COMMAND_NAME_RE =
	/<command-name>\/?([a-zA-Z][\w-]*(?::[\w-]*)*)<\/command-name>/g;

function extractCommandNames(text: string, knownSkills: Set<string>): string[] {
	const names: string[] = [];
	let match: RegExpExecArray | null;
	while ((match = COMMAND_NAME_RE.exec(text)) !== null) {
		const name = match[1]!;
		if (knownSkills.has(name)) {
			names.push(name);
		}
	}
	COMMAND_NAME_RE.lastIndex = 0;
	return names;
}

export function parseSessionFile(
	filePath: string,
	knownSkills: Set<string> = new Set(),
): Invocation[] {
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
			| { content: Array<Record<string, unknown>> | string }
			| undefined;

		if (obj.type === "user" && msg) {
			const text =
				typeof msg.content === "string"
					? msg.content
					: Array.isArray(msg.content)
						? msg.content
								.filter(
									(b): b is { type: string; text: string } =>
										typeof b === "object" &&
										b !== null &&
										b.type === "text" &&
										typeof b.text === "string",
								)
								.map((b) => b.text)
								.join("\n")
						: "";
			for (const name of extractCommandNames(text, knownSkills)) {
				results.push({
					skillName: name,
					timestamp,
					sessionId,
					agent: "claude",
				});
			}
			continue;
		}

		const msgContent =
			obj.type === "assistant" && msg && Array.isArray(msg.content)
				? (msg.content as Array<Record<string, unknown>>)
				: null;

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
					results.push({ skillName, timestamp, sessionId, agent: "claude" });
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
	knownSkills: Set<string> = new Set(),
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
		const invocations = parseSessionFile(file, knownSkills);
		total += recordNewInvocations(db, trackedSet, invocations);
	}

	return total;
}
