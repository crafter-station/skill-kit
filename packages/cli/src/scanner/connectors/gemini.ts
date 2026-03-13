import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { Invocation } from "../index";
import { recordNewInvocations } from "../index";

interface GeminiMessage {
	id?: string;
	timestamp?: string;
	type?: string;
	content?: string;
	toolCalls?: Array<{ name: string; args?: Record<string, unknown> }>;
	functionCalls?: Array<{ name: string; args?: Record<string, unknown> }>;
}

interface GeminiSession {
	sessionId: string;
	projectHash?: string;
	startTime?: string;
	lastUpdated?: string;
	messages: GeminiMessage[];
}

export function parseGeminiSessionFile(
	filePath: string,
	knownSkills: Set<string> = new Set(),
): Invocation[] {
	const results: Invocation[] = [];
	const sessionId = `gemini:${basename(filePath, ".json")}`;

	let content: string;
	try {
		content = readFileSync(filePath, "utf-8");
	} catch {
		return results;
	}

	let session: GeminiSession;
	try {
		session = JSON.parse(content) as GeminiSession;
	} catch {
		return results;
	}

	if (!Array.isArray(session.messages)) return results;

	for (const msg of session.messages) {
		const timestamp = msg.timestamp ?? session.startTime ?? new Date().toISOString();

		const calls = msg.toolCalls ?? msg.functionCalls ?? [];
		for (const call of calls) {
			if (call.name && (knownSkills.size === 0 || knownSkills.has(call.name))) {
				results.push({ skillName: call.name, timestamp, sessionId, agent: "gemini" });
			}
		}

		if (msg.type === "model" && typeof msg.content === "string") {
			const skillRe = /\bskill:([a-zA-Z][\w-]*)/g;
			let match: RegExpExecArray | null;
			while ((match = skillRe.exec(msg.content)) !== null) {
				const name = match[1]!;
				if (knownSkills.has(name)) {
					results.push({ skillName: name, timestamp, sessionId, agent: "gemini" });
				}
			}
		}
	}

	return results;
}

export function countGeminiSessions(): number {
	const tmpDir = join(homedir(), ".gemini", "tmp");
	if (!existsSync(tmpDir)) return 0;

	let count = 0;
	const glob = new Bun.Glob("**/chats/session-*.json");
	for (const _ of glob.scanSync({ cwd: tmpDir })) {
		count++;
	}
	return count;
}

export async function scanGeminiSessions(
	db: Database,
	trackedSet: Set<string>,
	knownSkills: Set<string> = new Set(),
): Promise<number> {
	const tmpDir = join(homedir(), ".gemini", "tmp");
	if (!existsSync(tmpDir)) return 0;

	const glob = new Bun.Glob("**/chats/session-*.json");
	const files: string[] = [];
	for await (const file of glob.scan({ cwd: tmpDir, absolute: true })) {
		files.push(file);
	}

	let total = 0;
	for (const file of files) {
		const invocations = parseGeminiSessionFile(file, knownSkills);
		total += recordNewInvocations(db, trackedSet, invocations);
	}

	return total;
}
