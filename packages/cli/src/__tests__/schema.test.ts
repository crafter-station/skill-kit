import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { deduplicatePersistedInvocationEvents } from "../db/schema";

function makeDb(): Database {
	const db = new Database(":memory:");
	db.run(`CREATE TABLE skill_invocations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		skill_name TEXT NOT NULL,
		timestamp TEXT NOT NULL,
		session_id TEXT,
		agent TEXT,
		event_id TEXT
	)`);
	return db;
}

describe("persisted invocation cleanup", () => {
	it("preserves distinct sessions and timestamps", () => {
		const db = makeDb();
		for (let index = 0; index < 3; index++) {
			db.run(
				"INSERT INTO skill_invocations (skill_name, timestamp, session_id, agent, event_id) VALUES (?, ?, ?, ?, ?)",
				[
					"shaping",
					`2026-08-30T10:0${index}:00Z`,
					`s${index}`,
					"codex",
					`e${index}`,
				],
			);
		}

		deduplicatePersistedInvocationEvents(db);

		const count = db
			.query<{ count: number }, []>(
				"SELECT COUNT(*) AS count FROM skill_invocations",
			)
			.get()?.count;
		expect(count).toBe(3);
	});

	it("removes only repeated event identities", () => {
		const db = makeDb();
		for (const timestamp of ["2026-08-30T10:00:00Z", "2026-08-30T10:01:00Z"]) {
			db.run(
				"INSERT INTO skill_invocations (skill_name, timestamp, session_id, agent, event_id) VALUES (?, ?, ?, ?, ?)",
				["shaping", timestamp, "s1", "codex", "e1"],
			);
		}

		deduplicatePersistedInvocationEvents(db);

		const count = db
			.query<{ count: number }, []>(
				"SELECT COUNT(*) AS count FROM skill_invocations",
			)
			.get()?.count;
		expect(count).toBe(1);
	});

	it("preserves reused event ids across sessions", () => {
		const db = makeDb();
		for (const session of ["s1", "s2"]) {
			db.run(
				"INSERT INTO skill_invocations (skill_name, timestamp, session_id, agent, event_id) VALUES (?, ?, ?, ?, ?)",
				["shaping", "2026-08-30T10:00:00Z", session, "codex", "e1"],
			);
		}

		deduplicatePersistedInvocationEvents(db);

		const count = db
			.query<{ count: number }, []>(
				"SELECT COUNT(*) AS count FROM skill_invocations",
			)
			.get()?.count;
		expect(count).toBe(2);
	});
});
