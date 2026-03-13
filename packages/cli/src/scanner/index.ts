import type { Database } from "bun:sqlite";
import { recordInvocation } from "../db/queries";
import { countClaudeSessions, scanClaudeSessions } from "./connectors/claude";
import { countCodexSessions, scanCodexSessions } from "./connectors/codex";
import { countCursorSessions, scanCursorSessions } from "./connectors/cursor";
import { countGeminiSessions, scanGeminiSessions } from "./connectors/gemini";
import {
	countOpenCodeSessions,
	scanOpenCodeSessions,
} from "./connectors/opencode";

interface AlreadyTracked {
	session_id: string;
	timestamp: string;
}

export function getTrackedSet(db: Database): Set<string> {
	const tracked = db
		.query<AlreadyTracked, []>(
			"SELECT session_id, timestamp FROM skill_invocations WHERE session_id IS NOT NULL",
		)
		.all();
	return new Set(tracked.map((r) => `${r.session_id}::${r.timestamp}`));
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
		const key = `${inv.sessionId}::${inv.timestamp}`;
		if (!trackedSet.has(key)) {
			recordInvocation(db, inv.skillName, inv.sessionId, undefined, inv.timestamp, inv.agent);
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
): Promise<number> {
	const trackedSet = getTrackedSet(db);
	let total = 0;
	if (!agentFilter || agentFilter === "claude") {
		total += await scanClaudeSessions(db, trackedSet, knownSkills);
	}
	if (!agentFilter || agentFilter === "opencode") {
		total += scanOpenCodeSessions(db, trackedSet);
	}
	if (!agentFilter || agentFilter === "cursor") {
		total += await scanCursorSessions(db, trackedSet, knownSkills);
	}
	if (!agentFilter || agentFilter === "codex") {
		total += await scanCodexSessions(db, trackedSet, knownSkills);
	}
	if (!agentFilter || agentFilter === "gemini") {
		total += await scanGeminiSessions(db, trackedSet, knownSkills);
	}
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
