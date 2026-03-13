import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { Invocation } from "../index";
import { recordNewInvocations } from "../index";

export function parseCodexSessionFile(
	filePath: string,
	knownSkills: Set<string> = new Set(),
): Invocation[] {
	const results: Invocation[] = [];
	const sessionId = `codex:${basename(filePath, ".jsonl")}`;

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

		const timestamp = typeof obj.timestamp === "string" ? obj.timestamp : new Date().toISOString();
		const type = obj.type as string | undefined;

		if (type === "response_item") {
			const payload = obj.payload as Record<string, unknown> | undefined;
			if (!payload) continue;

			if (payload.type === "function_call") {
				const name = payload.name as string | undefined;
				if (name && (knownSkills.size === 0 || knownSkills.has(name))) {
					results.push({ skillName: name, timestamp, sessionId, agent: "codex" });
				}
			}

			if (payload.type === "message" && payload.role === "assistant") {
				const content = payload.content as Array<Record<string, unknown>> | undefined;
				if (!Array.isArray(content)) continue;
				for (const block of content) {
					if (block.type === "tool_use" || block.type === "function_call") {
						const name = (block.name ?? block.skill) as string | undefined;
						if (name && (knownSkills.size === 0 || knownSkills.has(name))) {
							results.push({ skillName: name, timestamp, sessionId, agent: "codex" });
						}
					}
				}
			}
		}
	}

	return results;
}

export function countCodexSessions(): number {
	const sessionsDir = join(homedir(), ".codex", "sessions");
	if (!existsSync(sessionsDir)) return 0;

	let count = 0;
	const glob = new Bun.Glob("**/*.jsonl");
	for (const _ of glob.scanSync({ cwd: sessionsDir })) {
		count++;
	}
	return count;
}

export async function scanCodexSessions(
	db: Database,
	trackedSet: Set<string>,
	knownSkills: Set<string> = new Set(),
): Promise<number> {
	const sessionsDir = join(homedir(), ".codex", "sessions");
	if (!existsSync(sessionsDir)) return 0;

	const glob = new Bun.Glob("**/*.jsonl");
	const files: string[] = [];
	for await (const file of glob.scan({ cwd: sessionsDir, absolute: true })) {
		files.push(file);
	}

	let total = 0;
	for (const file of files) {
		const invocations = parseCodexSessionFile(file, knownSkills);
		total += recordNewInvocations(db, trackedSet, invocations);
	}

	return total;
}
