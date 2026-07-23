import type { Database } from "bun:sqlite";
import { Database as BunDatabase } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { basename, join } from "node:path";
import type { ProgressReporter } from "../../tui/progress";
import type { Invocation } from "../index";
import { recordNewInvocations } from "../index";
import type { ScanCache } from "../scan-cache";

const SKILL_PATH_RE = /skills\/([^/]+)\/SKILL\.md/;

// Goose stores message timestamps as unix seconds or millis; values above
// this threshold are millis (crates/goose/src/session/session_manager.rs).
const MILLISECOND_TIMESTAMP_THRESHOLD = 10_000_000_000;

const GOOSE_INTERNAL_TOOL_SUFFIXES = new Set([
	"shell",
	"text_editor",
	"list_windows",
	"screen_capture",
	"image_processor",
	"remember_memory",
	"retrieve_memories",
	"remove_memory_category",
	"search_available_extensions",
	"enable_extension",
	"manage_extensions",
	"manage_schedule",
	"read_resource",
	"list_resources",
	"final_output",
	"dynamic_task",
	"subagent",
	"load_skill",
]);

function stripExtensionPrefix(name: string): string {
	const idx = name.lastIndexOf("__");
	return idx >= 0 ? name.slice(idx + 2) : name;
}

function isInternalTool(name: string): boolean {
	return GOOSE_INTERNAL_TOOL_SUFFIXES.has(stripExtensionPrefix(name));
}

function normalizeTimestamp(raw: number): string {
	const millis = raw > MILLISECOND_TIMESTAMP_THRESHOLD ? raw : raw * 1000;
	const date = new Date(millis);
	if (Number.isNaN(date.getTime())) return new Date().toISOString();
	return date.toISOString();
}

interface GooseToolCallValue {
	name?: string;
	arguments?: Record<string, unknown>;
}

interface GooseToolCall {
	status?: string;
	value?: GooseToolCallValue;
	// Legacy sessions serialized the Ok variant inline without the
	// status/value envelope.
	name?: string;
	arguments?: Record<string, unknown>;
}

interface GooseMessageContent {
	type?: string;
	toolCall?: GooseToolCall;
}

function extractSkillFromToolCall(
	call: GooseToolCall,
	knownSkills: Set<string>,
): string | null {
	const value: GooseToolCallValue =
		call.value ?? (typeof call.name === "string" ? call : {});
	const name = value.name;
	if (typeof name !== "string") return null;

	// Native skills extension: skills__load_skill({ name: "my-skill" })
	// or load_skill({ name: "my-skill/template.md" }) for supporting files.
	if (stripExtensionPrefix(name) === "load_skill") {
		const arg = value.arguments?.name;
		if (typeof arg !== "string") return null;
		const skillName = arg.split("/")[0];
		return skillName || null;
	}

	// A skill's SKILL.md read through shell/text_editor etc.
	let serializedArgs = "";
	try {
		serializedArgs = JSON.stringify(value.arguments ?? {});
	} catch {}
	const pathMatch = SKILL_PATH_RE.exec(serializedArgs);
	if (pathMatch) return pathMatch[1] ?? null;

	// An extension tool whose name matches a tracked skill.
	if (isInternalTool(name)) return null;
	if (knownSkills.has(name)) return name;
	const stripped = stripExtensionPrefix(name);
	if (knownSkills.has(stripped)) return stripped;

	return null;
}

export function extractGooseInvocations(
	sessionId: string,
	role: string,
	contentJson: string,
	timestamp: string,
	knownSkills: Set<string> = new Set(),
): Invocation[] {
	const results: Invocation[] = [];
	if (role !== "assistant") return results;

	let content: unknown;
	try {
		content = JSON.parse(contentJson);
	} catch {
		return results;
	}
	if (!Array.isArray(content)) return results;

	for (const block of content as GooseMessageContent[]) {
		if (typeof block !== "object" || block === null) continue;
		if (block.type !== "toolRequest") continue;
		const call = block.toolCall;
		if (typeof call !== "object" || call === null) continue;

		const skillName = extractSkillFromToolCall(call, knownSkills);
		if (skillName) {
			results.push({
				skillName,
				timestamp,
				sessionId,
				agent: "goose",
			});
		}
	}

	return results;
}

export function parseGooseSessionFile(
	filePath: string,
	knownSkills: Set<string> = new Set(),
): Invocation[] {
	const results: Invocation[] = [];
	const sessionId = `goose:${basename(filePath, ".jsonl")}`;

	let content: string;
	try {
		content = readFileSync(filePath, "utf-8");
	} catch {
		return results;
	}

	const lines = content.split("\n");
	// First line is session metadata; remaining lines are Message JSON.
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line?.trim()) continue;

		let message: Record<string, unknown>;
		try {
			message = JSON.parse(line) as Record<string, unknown>;
		} catch {
			continue;
		}
		if (typeof message !== "object" || message === null) continue;

		const role = typeof message.role === "string" ? message.role : "";
		const created =
			typeof message.created === "number" ? message.created : null;
		const timestamp =
			created !== null ? normalizeTimestamp(created) : new Date().toISOString();

		let contentJson = "[]";
		try {
			contentJson = JSON.stringify(message.content ?? []);
		} catch {
			continue;
		}

		results.push(
			...extractGooseInvocations(
				sessionId,
				role,
				contentJson,
				timestamp,
				knownSkills,
			),
		);
	}

	return results;
}

function getSessionsDirCandidates(): string[] {
	const candidates: string[] = [];

	// GOOSE_PATH_ROOT overrides everything: data lives at <root>/data
	// (crates/goose/src/config/paths.rs).
	const pathRoot = process.env.GOOSE_PATH_ROOT;
	if (pathRoot) {
		candidates.push(join(pathRoot, "data", "sessions"));
		return candidates;
	}

	const os = platform();
	if (os === "win32") {
		candidates.push(
			join(
				process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
				"Block",
				"goose",
				"data",
				"sessions",
			),
		);
	} else {
		// choose_app_strategy uses XDG on macOS and Linux
		// (etcetera create_strategies!(Apple, Xdg) picks Xdg for apps).
		candidates.push(
			join(
				process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"),
				"goose",
				"sessions",
			),
		);
		if (os === "darwin") {
			candidates.push(
				join(
					homedir(),
					"Library",
					"Application Support",
					"Block",
					"goose",
					"sessions",
				),
			);
		}
	}
	return candidates;
}

function findSessionsDir(): string | null {
	for (const dir of getSessionsDirCandidates()) {
		if (existsSync(dir)) return dir;
	}
	return null;
}

function openGooseDb(
	sessionsDir: string,
): InstanceType<typeof BunDatabase> | null {
	const dbPath = join(sessionsDir, "sessions.db");
	if (!existsSync(dbPath)) return null;
	try {
		return new BunDatabase(dbPath, { readonly: true });
	} catch {
		return null;
	}
}

interface GooseMessageRow {
	session_id: string;
	role: string;
	content_json: string;
	created_timestamp: number;
}

function listLegacyFiles(sessionsDir: string): string[] {
	const files: string[] = [];
	const glob = new Bun.Glob("*.jsonl");
	for (const file of glob.scanSync({ cwd: sessionsDir, absolute: true })) {
		files.push(file);
	}
	return files;
}

export function countGooseSessions(): number {
	const sessionsDir = findSessionsDir();
	if (!sessionsDir) return 0;

	// Legacy jsonl files are imported into sessions.db on first run and kept
	// on disk, so when the db exists it is the single source of truth.
	const gooseDb = openGooseDb(sessionsDir);
	if (gooseDb) {
		try {
			const row = gooseDb
				.query<{ count: number }, []>("SELECT COUNT(*) as count FROM sessions")
				.get();
			return row?.count ?? 0;
		} catch {
			return 0;
		} finally {
			gooseDb.close();
		}
	}

	return listLegacyFiles(sessionsDir).length;
}

export function scanGooseDb(
	dbPath: string,
	db: Database,
	trackedSet: Set<string>,
	knownSkills: Set<string> = new Set(),
): number {
	if (!existsSync(dbPath)) return 0;

	let gooseDb: InstanceType<typeof BunDatabase>;
	try {
		gooseDb = new BunDatabase(dbPath, { readonly: true });
	} catch {
		return 0;
	}

	try {
		const rows = gooseDb
			.query<GooseMessageRow, []>(
				"SELECT session_id, role, content_json, created_timestamp FROM messages WHERE role = 'assistant' AND content_json LIKE '%toolRequest%'",
			)
			.all();

		const invocations: Invocation[] = [];
		for (const row of rows) {
			invocations.push(
				...extractGooseInvocations(
					`goose:${row.session_id}`,
					row.role,
					row.content_json,
					normalizeTimestamp(row.created_timestamp),
					knownSkills,
				),
			);
		}

		return recordNewInvocations(db, trackedSet, invocations);
	} catch {
		return 0;
	} finally {
		gooseDb.close();
	}
}

export async function scanGooseSessions(
	db: Database,
	trackedSet: Set<string>,
	knownSkills: Set<string> = new Set(),
	cache?: ScanCache,
	progress?: ProgressReporter,
): Promise<number> {
	const sessionsDir = findSessionsDir();
	if (!sessionsDir) return 0;

	// Legacy jsonl files are imported into sessions.db on first run and kept
	// on disk, so when the db exists it is the single source of truth.
	const dbPath = join(sessionsDir, "sessions.db");
	if (existsSync(dbPath)) {
		if (cache?.shouldSkip(dbPath)) return 0;
		const total = scanGooseDb(dbPath, db, trackedSet, knownSkills);
		progress?.finish();
		return total;
	}

	let total = 0;
	const files = listLegacyFiles(sessionsDir);
	let done = 0;
	for (const file of files) {
		done++;
		if (cache?.shouldSkip(file)) {
			progress?.update(done, files.length);
			continue;
		}
		const invocations = parseGooseSessionFile(file, knownSkills);
		total += recordNewInvocations(db, trackedSet, invocations);
		progress?.update(done, files.length);
	}
	progress?.finish();

	return total;
}
