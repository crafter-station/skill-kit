import type { Database } from "bun:sqlite";
import { recordInvocation } from "../db/queries";
import { createProgress } from "../tui/progress";
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

function roundTs(ts: string): string {
	return ts.replace(/\.\d{3}Z$/, "Z");
}

/**
 * Dedupe key for a source that carries a stable per-event id.
 *
 * Scoped by session because tool-call ids are only unique within a session,
 * not globally.
 */
export function eventKey(
	skillName: string,
	sessionId: string,
	eventId: string,
): string {
	return `${skillName}::e:${sessionId}::${eventId}`;
}

/**
 * Dedupe key for a source with no stable id, kept for backward compatibility.
 *
 * This key assumes timestamps are unique and stable across scans. Neither is
 * guaranteed: a connector reading the same event from two stores can see it
 * with different timestamp fidelity, and a source with no per-event time needs
 * a synthetic one. Prefer eventKey wherever the source provides an id.
 */
export function timestampKey(skillName: string, timestamp: string): string {
	return `${skillName}::${roundTs(timestamp)}`;
}

export function getTrackedSet(db: Database): Set<string> {
	type TrackedRow = {
		skill_name: string;
		timestamp: string;
		session_id: string | null;
		event_id: string | null;
	};

	let tracked: TrackedRow[];
	try {
		tracked = db
			.query<TrackedRow, []>(
				"SELECT skill_name, timestamp, session_id, event_id FROM skill_invocations",
			)
			.all();
	} catch {
		// Database predating the event_id column; timestamp keys still apply.
		tracked = db
			.query<TrackedRow, []>(
				"SELECT skill_name, timestamp, session_id, NULL as event_id FROM skill_invocations",
			)
			.all();
	}

	const keys = new Set<string>();
	for (const r of tracked) {
		// A row recorded with an event id is tracked under both keys: the strong
		// one, and the timestamp one so a re-scan that cannot recover the id
		// still recognizes the row instead of inserting a duplicate.
		if (r.event_id && r.session_id) {
			keys.add(eventKey(r.skill_name, r.session_id, r.event_id));
		}
		keys.add(timestampKey(r.skill_name, r.timestamp));
	}
	return keys;
}

export interface Invocation {
	skillName: string;
	timestamp: string;
	sessionId: string;
	agent?: string;
	/**
	 * Stable id for this event from the source itself (tool-call id, event id).
	 * When present it is what identifies the invocation across scans, so a
	 * source seen twice with drifting timestamps still dedupes.
	 */
	eventId?: string;
}

export function recordNewInvocations(
	db: Database,
	trackedSet: Set<string>,
	invocations: Invocation[],
): number {
	let count = 0;
	for (const inv of invocations) {
		if (!isSkillName(inv.skillName)) continue;

		const strongKey = inv.eventId
			? eventKey(inv.skillName, inv.sessionId, inv.eventId)
			: null;
		const weakKey = timestampKey(inv.skillName, inv.timestamp);

		// Either key matching means we already have this invocation.
		//
		// The event key catches what the timestamp key misses: two views of one
		// event that disagree on the time. The timestamp key still has to be
		// honoured even when an id is present, because rows recorded before ids
		// existed are only tracked under it, and skipping that check would
		// re-insert every one of them the first time a connector learns to
		// report an id.
		if (trackedSet.has(weakKey)) continue;
		if (strongKey && trackedSet.has(strongKey)) continue;

		const key = strongKey ?? weakKey;

		recordInvocation(
			db,
			inv.skillName,
			inv.sessionId,
			undefined,
			inv.timestamp,
			inv.agent,
			inv.eventId,
		);
		trackedSet.add(key);
		if (strongKey) trackedSet.add(weakKey);
		count++;
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
	const { connectors } = await import("./registry");
	const cache = new ScanCache(db, { force, salt: cacheSalt });
	const showProgress = !quiet && process.stdout.isTTY === true;
	const trackedSet = getTrackedSet(db);
	let total = 0;
	for (const connector of connectors) {
		if (agentFilter && connector.id !== agentFilter) continue;
		total += await connector.scan(
			db,
			trackedSet,
			knownSkills,
			cache,
			createProgress(`${connector.displayName} sessions`, showProgress),
		);
	}
	cache.flush();
	return total;
}

export function countAllSessions(agentFilter?: string): number {
	const { connectors } = require("./registry") as typeof import("./registry");
	let total = 0;
	for (const connector of connectors) {
		if (agentFilter && connector.id !== agentFilter) continue;
		total += connector.count();
	}
	return total;
}
