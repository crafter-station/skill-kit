import type { Database } from "bun:sqlite";
import { Database as SqliteDb } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { Invocation } from "../index";
import { recordNewInvocations } from "../index";

const STATE_VSCDB = join(
	homedir(),
	"Library",
	"Application Support",
	"Cursor",
	"User",
	"globalStorage",
	"state.vscdb",
);

interface BlobMessage {
	role: string;
	content:
		| string
		| Array<{
				type: string;
				toolName?: string;
				args?: Record<string, unknown>;
				arguments?: Record<string, unknown>;
				input?: Record<string, unknown>;
		  }>;
}

function extractSkillFromPath(path: string): string | null {
	const match = path.match(/skills\/([^/]+)\/SKILL\.md/);
	return match ? match[1]! : null;
}

function scanStateVscdb(_knownSkills: Set<string>): Invocation[] {
	if (!existsSync(STATE_VSCDB)) return [];

	const results: Invocation[] = [];

	try {
		const sdb = new SqliteDb(STATE_VSCDB, { readonly: true });

		const rows = sdb
			.query<{ key: string; value: Uint8Array | string }, []>(
				`SELECT key, value FROM cursorDiskKV
			 WHERE key LIKE 'agentKv:blob:%'
			 AND hex(substr(value, 1, 2)) = '7B22'
			 AND value LIKE '%SKILL.md%'`,
			)
			.all();

		for (const row of rows) {
			let text: string;
			try {
				if (row.value instanceof Uint8Array) {
					text = new TextDecoder().decode(row.value);
				} else if (typeof row.value === "string") {
					text = row.value;
				} else {
					text = String(row.value);
				}
			} catch {
				continue;
			}

			let msg: BlobMessage;
			try {
				msg = JSON.parse(text) as BlobMessage;
			} catch {
				continue;
			}

			if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;

			for (const item of msg.content) {
				if (item.type !== "tool-call") continue;

				const args =
					item.args ?? item.arguments ?? item.input ?? ({} as Record<string, unknown>);
				const path = String(
					args.path ?? args.filePath ?? args.file_path ?? "",
				);

				if (!path.includes("SKILL.md")) continue;

				const skillName = extractSkillFromPath(path);
				if (!skillName) continue;

				const blobHash = row.key.split(":").pop() ?? row.key;
				results.push({
					skillName,
					timestamp: new Date().toISOString(),
					sessionId: `cursor:vscdb:${blobHash.slice(0, 16)}`,
					agent: "cursor",
				});
			}
		}

		sdb.close();
	} catch {
		return results;
	}

	return results;
}

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
		const msg = obj.message as
			| { content: Array<Record<string, unknown>> | string }
			| undefined;
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
					const input = (block as { input?: Record<string, unknown> })
						.input;
					if (!input) continue;
					const skillName = (input.skill ??
						input.name ??
						input.skillName) as string | undefined;
					if (
						skillName &&
						(knownSkills.size === 0 || knownSkills.has(skillName))
					) {
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
			const text =
				typeof msg.content === "string"
					? msg.content
					: contentArr
							.filter(
								(
									b,
								): b is {
									type: string;
									text: string;
								} =>
									typeof b === "object" &&
									b !== null &&
									b.type === "text" &&
									typeof b.text === "string",
							)
							.map((b) => b.text)
							.join("\n");

			const commandRe =
				/<command-name>\/?([a-zA-Z][\w-]*(?::[\w-]*)*)<\/command-name>/g;
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
	let count = 0;

	const projectsDir = join(homedir(), ".cursor", "projects");
	if (existsSync(projectsDir)) {
		const glob = new Bun.Glob("**/agent-transcripts/**/*.jsonl");
		for (const _ of glob.scanSync({ cwd: projectsDir })) {
			count++;
		}
	}

	if (existsSync(STATE_VSCDB)) {
		try {
			const sdb = new SqliteDb(STATE_VSCDB, { readonly: true });
			const row = sdb
				.query<{ count: number }, []>(
					"SELECT COUNT(DISTINCT key) as count FROM cursorDiskKV WHERE key LIKE 'agentKv:blob:%' AND value LIKE '%SKILL.md%'",
				)
				.get();
			count += row?.count ?? 0;
			sdb.close();
		} catch {}
	}

	return count;
}

export async function scanCursorSessions(
	db: Database,
	trackedSet: Set<string>,
	knownSkills: Set<string> = new Set(),
): Promise<number> {
	let total = 0;

	const projectsDir = join(homedir(), ".cursor", "projects");
	if (existsSync(projectsDir)) {
		const glob = new Bun.Glob("**/agent-transcripts/**/*.jsonl");
		const files: string[] = [];
		for await (const file of glob.scan({ cwd: projectsDir, absolute: true })) {
			files.push(file);
		}
		for (const file of files) {
			const invocations = parseCursorSessionFile(file, knownSkills);
			total += recordNewInvocations(db, trackedSet, invocations);
		}
	}

	const vscdbInvocations = scanStateVscdb(knownSkills);
	total += recordNewInvocations(db, trackedSet, vscdbInvocations);

	return total;
}
