import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { recordInvocation } from "../db/queries";

interface ToolUseBlock {
	type: "tool_use";
	name: string;
	input: Record<string, unknown>;
}

interface AssistantMessage {
	type: "assistant";
	message: {
		content: Array<ToolUseBlock | { type: string }>;
	};
}

function extractSessionId(filePath: string): string {
	return basename(filePath, ".jsonl");
}

function extractSkillName(block: ToolUseBlock): string | null {
	const input = block.input;
	if (typeof input.skill === "string") return input.skill;
	if (typeof input.name === "string") return input.name;
	if (typeof input.skillName === "string") return input.skillName;
	return null;
}

export function parseSessionFile(
	filePath: string,
): Array<{ skillName: string; timestamp: string; sessionId: string }> {
	const results: Array<{
		skillName: string;
		timestamp: string;
		sessionId: string;
	}> = [];
	const sessionId = extractSessionId(filePath);

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

		const msg = obj.message as AssistantMessage["message"] | undefined;
		const content = obj.type === "assistant" && msg ? msg.content : null;

		if (!Array.isArray(content)) continue;

		for (const block of content) {
			if (
				typeof block === "object" &&
				block !== null &&
				(block as Record<string, unknown>).type === "tool_use" &&
				(block as ToolUseBlock).name === "Skill"
			) {
				const skillName = extractSkillName(block as ToolUseBlock);
				if (skillName) {
					results.push({ skillName, timestamp, sessionId });
				}
			}
		}
	}

	return results;
}

interface AlreadyTracked {
	session_id: string;
	timestamp: string;
}

export async function scanAllSessions(db: Database): Promise<number> {
	const projectsDir = join(homedir(), ".claude", "projects");
	if (!existsSync(projectsDir)) return 0;

	const glob = new Bun.Glob("**/*.jsonl");
	const files: string[] = [];

	for await (const file of glob.scan({ cwd: projectsDir, absolute: true })) {
		files.push(file);
	}

	const tracked = db
		.query<AlreadyTracked, []>(
			"SELECT session_id, timestamp FROM skill_invocations WHERE session_id IS NOT NULL",
		)
		.all();
	const trackedSet = new Set(
		tracked.map((r) => `${r.session_id}::${r.timestamp}`),
	);

	let newCount = 0;
	for (const file of files) {
		const invocations = parseSessionFile(file);
		for (const inv of invocations) {
			const key = `${inv.sessionId}::${inv.timestamp}`;
			if (!trackedSet.has(key)) {
				recordInvocation(db, inv.skillName, inv.sessionId);
				trackedSet.add(key);
				newCount++;
			}
		}
	}

	return newCount;
}
