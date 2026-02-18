import type { Database } from "bun:sqlite";
import { recordInvocation } from "../db/queries";
import { countClaudeSessions, scanClaudeSessions } from "./connectors/claude";
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
			recordInvocation(db, inv.skillName, inv.sessionId, undefined, inv.timestamp);
			trackedSet.add(key);
			count++;
		}
	}
	return count;
}

export async function scanAllSessions(
	db: Database,
	knownSkills: Set<string> = new Set(),
): Promise<number> {
	const trackedSet = getTrackedSet(db);
	let total = 0;
	total += await scanClaudeSessions(db, trackedSet, knownSkills);
	total += scanOpenCodeSessions(db, trackedSet);
	return total;
}

export function countAllSessions(): number {
	return countClaudeSessions() + countOpenCodeSessions();
}
