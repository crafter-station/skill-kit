import type { Database } from "bun:sqlite";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { ProgressReporter } from "../../tui/progress";
import type { Invocation } from "../index";
import { recordNewInvocations } from "../index";
import type { ScanCache } from "../scan-cache";

const SKILL_PATH_RE = /skills\/([^/]+)\/SKILL\.md/;

const CONTINUE_INTERNAL_TOOLS = new Set([
	"Read",
	"Write",
	"Edit",
	"MultiEdit",
	"Bash",
	"List",
	"Search",
	"Fetch",
	"Diff",
	"Checklist",
	"AskQuestion",
	"Exit",
	"read_file",
	"write_file",
	"edit_file",
	"run_terminal_command",
	"list_directory",
	"grep_search",
	"glob_search",
	"fetch_url_content",
	"view_diff",
	"read_currently_open_file",
	"create_new_file",
	"search_web",
	"view_repo_map",
	"view_subdirectory",
	"codebase_tool",
	"request_rule",
]);

function isInternalTool(name: string): boolean {
	return (
		CONTINUE_INTERNAL_TOOLS.has(name) ||
		name.startsWith("mcp__") ||
		name.startsWith("mcp_")
	);
}

interface ContinueToolFunction {
	name?: string;
	arguments?: string;
}

interface ContinueToolCall {
	id?: string;
	type?: string;
	function?: ContinueToolFunction;
}

interface ContinueToolCallState {
	toolCallId?: string;
	toolCall?: ContinueToolCall;
	parsedArgs?: Record<string, unknown>;
}

interface ContinueChatMessage {
	role?: string;
	content?: unknown;
	toolCalls?: ContinueToolCall[];
}

interface ContinueHistoryItem {
	message?: ContinueChatMessage;
	toolCallStates?: ContinueToolCallState[];
}

interface ContinueSession {
	sessionId?: string;
	title?: string;
	workspaceDirectory?: string;
	history?: ContinueHistoryItem[];
}

interface ContinueSessionsIndexEntry {
	sessionId?: string;
	dateCreated?: string;
}

function getContinueGlobalDir(): string {
	return process.env.CONTINUE_GLOBAL_DIR || join(homedir(), ".continue");
}

function getSessionsDir(): string {
	return join(getContinueGlobalDir(), "sessions");
}

function parseIndexTimestamp(raw: string): string | null {
	// sessions.json stores dateCreated as String(Date.now()) (epoch millis),
	// but tolerate ISO strings too.
	const asNumber = Number(raw);
	if (Number.isFinite(asNumber) && raw.trim() !== "") {
		const date = new Date(asNumber);
		if (!Number.isNaN(date.getTime())) return date.toISOString();
	}
	const date = new Date(raw);
	if (!Number.isNaN(date.getTime())) return date.toISOString();
	return null;
}

function readSessionIndex(sessionsDir: string): Map<string, string> {
	const index = new Map<string, string>();
	const indexPath = join(sessionsDir, "sessions.json");
	if (!existsSync(indexPath)) return index;

	let entries: unknown;
	try {
		entries = JSON.parse(readFileSync(indexPath, "utf-8"));
	} catch {
		return index;
	}
	if (!Array.isArray(entries)) return index;

	for (const entry of entries as ContinueSessionsIndexEntry[]) {
		if (typeof entry !== "object" || entry === null) continue;
		if (typeof entry.sessionId !== "string") continue;
		if (typeof entry.dateCreated !== "string") continue;
		const ts = parseIndexTimestamp(entry.dateCreated);
		if (ts) index.set(entry.sessionId, ts);
	}
	return index;
}

// birthtime, not mtime: an active session file's mtime moves on every
// write, which would mint a fresh dedupe key per scan and re-record the
// session's history. Creation time is stable for the file's lifetime.
function fileTimestamp(filePath: string): string {
	try {
		const stat = statSync(filePath);
		const birth = stat.birthtime.getTime();
		return (birth > 0 ? stat.birthtime : stat.mtime).toISOString();
	} catch {
		return new Date(0).toISOString();
	}
}

function extractSkillFromToolCall(
	name: string | undefined,
	args: string,
	parsedArgs: Record<string, unknown> | undefined,
	knownSkills: Set<string>,
): string | null {
	// Built-in "Skills" tool: { skill_name: "..." }
	if (name === "Skills") {
		if (typeof parsedArgs?.skill_name === "string")
			return parsedArgs.skill_name;
		try {
			const parsed = JSON.parse(args) as Record<string, unknown>;
			if (typeof parsed.skill_name === "string") return parsed.skill_name;
		} catch {}
		return null;
	}

	// A skill's SKILL.md read through any tool (file path in arguments)
	const pathMatch = SKILL_PATH_RE.exec(args);
	if (pathMatch) return pathMatch[1] ?? null;

	// A tool whose name matches a tracked skill (e.g. MCP-exposed skill)
	if (name && !isInternalTool(name) && knownSkills.has(name)) return name;

	return null;
}

export function parseContinueSessionFile(
	filePath: string,
	knownSkills: Set<string> = new Set(),
	timestampOverride?: string,
): Invocation[] {
	const results: Invocation[] = [];
	const sessionId = `continue:${basename(filePath, ".json")}`;

	let content: string;
	try {
		content = readFileSync(filePath, "utf-8");
	} catch {
		return results;
	}

	let session: ContinueSession;
	try {
		session = JSON.parse(content) as ContinueSession;
	} catch {
		return results;
	}

	if (!Array.isArray(session.history)) return results;

	const timestamp = timestampOverride ?? fileTimestamp(filePath);
	const seenCallIds = new Set<string>();

	const record = (skillName: string, callId: string | undefined) => {
		if (callId) {
			if (seenCallIds.has(callId)) return;
			seenCallIds.add(callId);
		}
		results.push({
			skillName,
			timestamp,
			sessionId,
			agent: "continue",
		});
	};

	for (const item of session.history) {
		if (typeof item !== "object" || item === null) continue;

		const message = item.message;
		if (message?.role === "assistant" && Array.isArray(message.toolCalls)) {
			for (const call of message.toolCalls) {
				if (typeof call !== "object" || call === null) continue;
				const fn = call.function;
				const skillName = extractSkillFromToolCall(
					fn?.name,
					typeof fn?.arguments === "string" ? fn.arguments : "",
					undefined,
					knownSkills,
				);
				if (skillName) record(skillName, call.id);
			}
		}

		if (Array.isArray(item.toolCallStates)) {
			for (const state of item.toolCallStates) {
				if (typeof state !== "object" || state === null) continue;
				const fn = state.toolCall?.function;
				const skillName = extractSkillFromToolCall(
					fn?.name,
					typeof fn?.arguments === "string" ? fn.arguments : "",
					state.parsedArgs,
					knownSkills,
				);
				if (skillName)
					record(skillName, state.toolCallId ?? state.toolCall?.id);
			}
		}
	}

	return results;
}

export function countContinueSessions(): number {
	const sessionsDir = getSessionsDir();
	if (!existsSync(sessionsDir)) return 0;

	let count = 0;
	const glob = new Bun.Glob("*.json");
	for (const file of glob.scanSync({ cwd: sessionsDir })) {
		if (basename(file) === "sessions.json") continue;
		count++;
	}
	return count;
}

export async function scanContinueSessions(
	db: Database,
	trackedSet: Set<string>,
	knownSkills: Set<string> = new Set(),
	cache?: ScanCache,
	progress?: ProgressReporter,
): Promise<number> {
	const sessionsDir = getSessionsDir();
	if (!existsSync(sessionsDir)) return 0;

	const glob = new Bun.Glob("*.json");
	const files: string[] = [];
	for await (const file of glob.scan({ cwd: sessionsDir, absolute: true })) {
		if (basename(file) === "sessions.json") continue;
		files.push(file);
	}

	const index = readSessionIndex(sessionsDir);

	let total = 0;
	let done = 0;
	for (const file of files) {
		done++;
		if (cache?.shouldSkip(file)) {
			progress?.update(done, files.length);
			continue;
		}
		const sessionId = basename(file, ".json");
		const invocations = parseContinueSessionFile(
			file,
			knownSkills,
			index.get(sessionId),
		);
		total += recordNewInvocations(db, trackedSet, invocations);
		progress?.update(done, files.length);
	}
	progress?.finish();

	return total;
}
