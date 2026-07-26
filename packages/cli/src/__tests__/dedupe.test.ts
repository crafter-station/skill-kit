import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import {
	eventKey,
	getTrackedSet,
	type Invocation,
	recordNewInvocations,
	timestampKey,
} from "../scanner";

function freshDb(): Database {
	const db = new Database(":memory:");
	db.run(`
		CREATE TABLE skill_invocations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			skill_name TEXT NOT NULL,
			timestamp TEXT NOT NULL,
			session_id TEXT,
			project TEXT,
			success INTEGER DEFAULT 1,
			agent TEXT,
			event_id TEXT
		)
	`);
	db.run(`
		CREATE TABLE skill_daily_stats (
			date TEXT NOT NULL,
			skill_name TEXT NOT NULL,
			count INTEGER DEFAULT 0,
			UNIQUE(date, skill_name)
		)
	`);
	return db;
}

function rows(db: Database) {
	return db
		.query(
			"SELECT skill_name, timestamp, session_id, event_id FROM skill_invocations",
		)
		.all() as Array<{
		skill_name: string;
		timestamp: string;
		session_id: string | null;
		event_id: string | null;
	}>;
}

describe("recordNewInvocations", () => {
	let db: Database;
	beforeEach(() => {
		db = freshDb();
	});

	it("records a new invocation and persists its event id", () => {
		const inv: Invocation = {
			skillName: "research",
			timestamp: "2026-07-26T10:00:00.000Z",
			sessionId: "s1",
			agent: "claude",
			eventId: "toolu_01abc",
		};

		expect(recordNewInvocations(db, new Set(), [inv])).toBe(1);
		expect(rows(db)).toHaveLength(1);
		expect(rows(db)[0]?.event_id).toBe("toolu_01abc");
	});

	// The bug this fixes: one connector seeing the same event through two
	// stores with different timestamp fidelity used to insert it twice,
	// because the key was skillName::timestamp and the timestamps differed.
	it("dedupes one event seen twice with timestamps more than a second apart", () => {
		const tracked = new Set<string>();
		const first: Invocation = {
			skillName: "research",
			timestamp: "2026-07-26T10:00:00.000Z",
			sessionId: "s1",
			eventId: "call_xyz",
		};
		const second: Invocation = {
			...first,
			timestamp: "2026-07-26T10:00:47.000Z",
		};

		expect(recordNewInvocations(db, tracked, [first])).toBe(1);
		expect(recordNewInvocations(db, tracked, [second])).toBe(0);
		expect(rows(db)).toHaveLength(1);
	});

	it("still dedupes by timestamp when no event id is present", () => {
		const tracked = new Set<string>();
		const inv: Invocation = {
			skillName: "research",
			timestamp: "2026-07-26T10:00:00.000Z",
			sessionId: "s1",
		};

		expect(recordNewInvocations(db, tracked, [inv])).toBe(1);
		expect(recordNewInvocations(db, tracked, [inv])).toBe(0);
		expect(rows(db)).toHaveLength(1);
	});

	// Tool-call ids are only unique within a session, so the event key is
	// session-scoped. Two sessions reusing an id are two invocations.
	it("treats the same event id in two sessions as two invocations", () => {
		const tracked = new Set<string>();
		const a: Invocation = {
			skillName: "research",
			timestamp: "2026-07-26T10:00:00.000Z",
			sessionId: "s1",
			eventId: "call_1",
		};
		// Different time as well: the timestamp key is global, and collapsing
		// two same-instant invocations is pre-existing behaviour this change
		// deliberately preserves (no such pair exists in practice).
		const b: Invocation = {
			...a,
			sessionId: "s2",
			timestamp: "2026-07-26T10:00:05.000Z",
		};

		expect(recordNewInvocations(db, tracked, [a, b])).toBe(2);
		expect(rows(db)).toHaveLength(2);
	});

	it("collapses two invocations that share a skill and instant", () => {
		const tracked = new Set<string>();
		const ts = "2026-07-26T10:00:00.000Z";

		// Pre-existing behaviour, kept intentionally: the timestamp key is not
		// session-scoped. Verified against real data, where no such pair occurs.
		const n = recordNewInvocations(db, tracked, [
			{ skillName: "research", timestamp: ts, sessionId: "s1" },
			{ skillName: "research", timestamp: ts, sessionId: "s2" },
		]);

		expect(n).toBe(1);
	});

	it("keeps distinct skills at the same timestamp", () => {
		const tracked = new Set<string>();
		const ts = "2026-07-26T10:00:00.000Z";

		const n = recordNewInvocations(db, tracked, [
			{ skillName: "research", timestamp: ts, sessionId: "s1" },
			{ skillName: "deslop", timestamp: ts, sessionId: "s1" },
		]);

		expect(n).toBe(2);
	});

	// A row written with an id must still be recognized by a later scan that
	// cannot recover one, otherwise the fallback path would duplicate it.
	it("does not re-insert an id-tracked row when a later scan has no id", () => {
		const tracked = new Set<string>();
		const withId: Invocation = {
			skillName: "research",
			timestamp: "2026-07-26T10:00:00.000Z",
			sessionId: "s1",
			eventId: "call_1",
		};

		expect(recordNewInvocations(db, tracked, [withId])).toBe(1);

		const { eventId: _dropped, ...withoutId } = withId;
		expect(recordNewInvocations(db, tracked, [withoutId])).toBe(0);
		expect(rows(db)).toHaveLength(1);
	});

	// Rows written before any connector reported ids are tracked only by their
	// timestamp key. When a connector later learns to report an id, the same
	// invocation must not be inserted a second time.
	it("does not duplicate a pre-existing row once the connector starts reporting ids", () => {
		const tracked = new Set<string>();
		const ts = "2026-07-26T10:00:00.000Z";

		expect(
			recordNewInvocations(db, tracked, [
				{ skillName: "research", timestamp: ts, sessionId: "s1" },
			]),
		).toBe(1);

		// Same event, same time, but this scan can name it.
		expect(
			recordNewInvocations(db, tracked, [
				{
					skillName: "research",
					timestamp: ts,
					sessionId: "s1",
					eventId: "call_1",
				},
			]),
		).toBe(0);
		expect(rows(db)).toHaveLength(1);
	});

	it("skips names that are not skills", () => {
		const n = recordNewInvocations(db, new Set(), [
			{
				skillName: "mcp__firecrawl__search",
				timestamp: "2026-07-26T10:00:00.000Z",
				sessionId: "s1",
			},
		]);

		expect(n).toBe(0);
		expect(rows(db)).toHaveLength(0);
	});
});

describe("getTrackedSet", () => {
	it("tracks an id-bearing row under both its event key and its timestamp key", () => {
		const db = freshDb();
		recordNewInvocations(db, new Set(), [
			{
				skillName: "research",
				timestamp: "2026-07-26T10:00:00.000Z",
				sessionId: "s1",
				eventId: "call_1",
			},
		]);

		const tracked = getTrackedSet(db);

		expect(tracked.has(eventKey("research", "s1", "call_1"))).toBe(true);
		expect(
			tracked.has(timestampKey("research", "2026-07-26T10:00:00.000Z")),
		).toBe(true);
	});

	it("survives a scan across process restarts without duplicating", () => {
		const db = freshDb();
		const inv: Invocation = {
			skillName: "research",
			timestamp: "2026-07-26T10:00:00.000Z",
			sessionId: "s1",
			eventId: "call_1",
		};

		recordNewInvocations(db, getTrackedSet(db), [inv]);
		// Second run rebuilds the set from the database, as a new process would.
		recordNewInvocations(db, getTrackedSet(db), [
			{ ...inv, timestamp: "2026-07-26T10:05:00.000Z" },
		]);

		expect(rows(db)).toHaveLength(1);
	});
});

// A database created before the event_id migration must keep working: the
// scanner should degrade to timestamp keys rather than throwing.
describe("database predating the event_id column", () => {
	function legacyDb(): Database {
		const db = new Database(":memory:");
		db.run(`
			CREATE TABLE skill_invocations (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				skill_name TEXT NOT NULL,
				timestamp TEXT NOT NULL,
				session_id TEXT,
				project TEXT,
				success INTEGER DEFAULT 1,
				agent TEXT
			)
		`);
		db.run(`
			CREATE TABLE skill_daily_stats (
				date TEXT NOT NULL,
				skill_name TEXT NOT NULL,
				count INTEGER DEFAULT 0,
				UNIQUE(date, skill_name)
			)
		`);
		return db;
	}

	it("records an invocation that carries an event id without throwing", () => {
		const db = legacyDb();

		expect(() =>
			recordNewInvocations(db, new Set(), [
				{
					skillName: "research",
					timestamp: "2026-07-26T10:00:00.000Z",
					sessionId: "s1",
					eventId: "call_1",
				},
			]),
		).not.toThrow();

		expect(
			db.query("SELECT COUNT(*) as n FROM skill_invocations").get(),
		).toMatchObject({ n: 1 });
	});

	it("builds a tracked set from the legacy schema", () => {
		const db = legacyDb();
		recordNewInvocations(db, new Set(), [
			{
				skillName: "research",
				timestamp: "2026-07-26T10:00:00.000Z",
				sessionId: "s1",
			},
		]);

		const tracked = getTrackedSet(db);

		expect(
			tracked.has(timestampKey("research", "2026-07-26T10:00:00.000Z")),
		).toBe(true);
	});
});

describe("key builders", () => {
	it("scopes the event key by session", () => {
		expect(eventKey("a", "s1", "e1")).not.toBe(eventKey("a", "s2", "e1"));
	});

	it("strips milliseconds in the timestamp key", () => {
		expect(timestampKey("a", "2026-07-26T10:00:00.123Z")).toBe(
			timestampKey("a", "2026-07-26T10:00:00.999Z"),
		);
	});
});
