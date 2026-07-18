import type { Database } from "bun:sqlite";
import { recordInvocation } from "../db/queries";
import { createProgress } from "../tui/progress";
import { countClaudeSessions, scanClaudeSessions } from "./connectors/claude";
import { countCodexSessions, scanCodexSessions } from "./connectors/codex";
import { countCursorSessions, scanCursorSessions } from "./connectors/cursor";
import { countGeminiSessions, scanGeminiSessions } from "./connectors/gemini";
import {
	countOpenCodeSessions,
	scanOpenCodeSessions,
} from "./connectors/opencode";
import { ScanCache } from "./scan-cache";

const BUILTIN_TOOL_NAMES = new Set([
	"Read",
	"Write",
	"Edit",
	"MultiEdit",
	"Bash",
	"Glob",
	"Grep",
	"WebSearch",
	"WebFetch",
	"TodoRead",
	"TodoWrite",
	"Task",
	"Agent",
	"Skill",
	"LSP",
	"NotebookEdit",
	"AskFollowupQuestion",
	"AttemptCompletion",
	"SearchReplace",
	"InsertCodeBlock",
	"ReadImages",
	"ExecuteCommand",
	"ListFiles",
	"SearchFiles",
	"ReadFile",
	"WriteFile",
	"ReplaceInFile",
	"ListCodeDefinitionNames",
	"BrowserAction",
	"UseMcp",
	"shell",
	"shell_command",
	"update_plan",
	"create_plan",
	"read_file",
	"write_file",
	"execute_command",
	"spawn_agent",
	"write_stdin",
	"multi_tool_use.parallel",
]);

export function isSkillName(name: string): boolean {
	if (BUILTIN_TOOL_NAMES.has(name)) return false;
	if (name.startsWith("mcp__") || name.startsWith("mcp_")) return false;
	return true;
}

interface AlreadyTracked {
	session_id: string;
	timestamp: string;
}

function roundTs(ts: string): string {
	return ts.replace(/\.\d{3}Z$/, "Z");
}

export function getTrackedSet(db: Database): Set<string> {
	const tracked = db
		.query<{ skill_name: string; timestamp: string }, []>(
			"SELECT skill_name, timestamp FROM skill_invocations",
		)
		.all();
	return new Set(
		tracked.map((r) => `${r.skill_name}::${roundTs(r.timestamp)}`),
	);
}

export interface Invocation {
	skillName: string;
	timestamp: string;
	sessionId: string;
	agent?: string;
}

export function recordNewInvocations(
	db: Database,
	trackedSet: Set<string>,
	invocations: Invocation[],
): number {
	let count = 0;
	for (const inv of invocations) {
		if (!isSkillName(inv.skillName)) continue;
		const key = `${inv.skillName}::${roundTs(inv.timestamp)}`;
		if (!trackedSet.has(key)) {
			recordInvocation(
				db,
				inv.skillName,
				inv.sessionId,
				undefined,
				inv.timestamp,
				inv.agent,
			);
			trackedSet.add(key);
			count++;
		}
	}
	return count;
}

export async function scanAllSessions(
	db: Database,
	knownSkills: Set<string> = new Set(),
	agentFilter?: string,
	options: { force?: boolean; quiet?: boolean; cacheSalt?: string } = {},
): Promise<number> {
	const { force = false, quiet = true, cacheSalt = "" } = options;
	const cache = new ScanCache(db, { force, salt: cacheSalt });
	const showProgress = !quiet && process.stdout.isTTY === true;
	const trackedSet = getTrackedSet(db);
	let total = 0;
	if (!agentFilter || agentFilter === "claude") {
		total += await scanClaudeSessions(
			db,
			trackedSet,
			knownSkills,
			cache,
			createProgress("Claude Code sessions", showProgress),
		);
	}
	if (!agentFilter || agentFilter === "opencode") {
		total += scanOpenCodeSessions(db, trackedSet, cache);
	}
	if (!agentFilter || agentFilter === "cursor") {
		total += await scanCursorSessions(
			db,
			trackedSet,
			knownSkills,
			cache,
			createProgress("Cursor sessions", showProgress),
		);
	}
	if (!agentFilter || agentFilter === "codex") {
		total += await scanCodexSessions(
			db,
			trackedSet,
			knownSkills,
			cache,
			createProgress("Codex sessions", showProgress),
		);
	}
	if (!agentFilter || agentFilter === "gemini") {
		total += await scanGeminiSessions(
			db,
			trackedSet,
			knownSkills,
			cache,
			createProgress("Gemini CLI sessions", showProgress),
		);
	}
	cache.flush();
	return total;
}

export function countAllSessions(agentFilter?: string): number {
	let total = 0;
	if (!agentFilter || agentFilter === "claude") {
		total += countClaudeSessions();
	}
	if (!agentFilter || agentFilter === "opencode") {
		total += countOpenCodeSessions();
	}
	if (!agentFilter || agentFilter === "cursor") {
		total += countCursorSessions();
	}
	if (!agentFilter || agentFilter === "codex") {
		total += countCodexSessions();
	}
	if (!agentFilter || agentFilter === "gemini") {
		total += countGeminiSessions();
	}
	return total;
}
