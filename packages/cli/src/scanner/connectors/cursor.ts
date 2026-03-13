import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { Invocation } from "../index";
import { recordNewInvocations } from "../index";

export function parseCursorSessionFile(
	filePath: string,
	knownSkills: Set<string> = new Set(),
): Invocation[] {
	const results: Invocation[] = [];
	const sessionId = `cursor:${basename(filePath, ".jsonl")}`;

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

		const role = obj.role as string | undefined;
		const msg = obj.message as { content: Array<Record<string, unknown>> | string } | undefined;
		if (!msg) continue;

		const contentArr = Array.isArray(msg.content) ? msg.content : [];

		if (role === "assistant") {
			for (const block of contentArr) {
				if (
					typeof block === "object" &&
					block !== null &&
					block.type === "tool_use" &&
					(block as { name?: string }).name === "Skill"
				) {
					const input = (block as { input?: Record<string, unknown> }).input;
					if (!input) continue;
					const skillName = (input.skill ?? input.name ?? input.skillName) as string | undefined;
					if (skillName && (knownSkills.size === 0 || knownSkills.has(skillName))) {
						results.push({
							skillName,
							timestamp: new Date().toISOString(),
							sessionId,
							agent: "cursor",
						});
					}
				}
			}
		}

		if (role === "user") {
			const text = typeof msg.content === "string"
				? msg.content
				: contentArr
					.filter((b): b is { type: string; text: string } =>
						typeof b === "object" && b !== null && b.type === "text" && typeof b.text === "string")
					.map((b) => b.text)
					.join("\n");

			const commandRe = /<command-name>\/?([a-zA-Z][\w-]*(?::[\w-]*)*)<\/command-name>/g;
			let match: RegExpExecArray | null;
			while ((match = commandRe.exec(text)) !== null) {
				const name = match[1]!;
				if (knownSkills.has(name)) {
					results.push({
						skillName: name,
						timestamp: new Date().toISOString(),
						sessionId,
						agent: "cursor",
					});
				}
			}
		}
	}

	return results;
}

export function countCursorSessions(): number {
	const projectsDir = join(homedir(), ".cursor", "projects");
	if (!existsSync(projectsDir)) return 0;

	let count = 0;
	const glob = new Bun.Glob("**/agent-transcripts/**/*.jsonl");
	for (const _ of glob.scanSync({ cwd: projectsDir })) {
		count++;
	}
	return count;
}

export async function scanCursorSessions(
	db: Database,
	trackedSet: Set<string>,
	knownSkills: Set<string> = new Set(),
): Promise<number> {
	const projectsDir = join(homedir(), ".cursor", "projects");
	if (!existsSync(projectsDir)) return 0;

	const glob = new Bun.Glob("**/agent-transcripts/**/*.jsonl");
	const files: string[] = [];
	for await (const file of glob.scan({ cwd: projectsDir, absolute: true })) {
		files.push(file);
	}

	let total = 0;
	for (const file of files) {
		const invocations = parseCursorSessionFile(file, knownSkills);
		total += recordNewInvocations(db, trackedSet, invocations);
	}

	return total;
}
