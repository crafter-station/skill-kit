import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	countOpenCodeSessions,
	scanOpenCodeSessions,
} from "../scanner/connectors/opencode";

function makeSkillkitDb(): Database {
	const db = new Database(":memory:");
	db.run(`CREATE TABLE IF NOT EXISTS skill_invocations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		skill_name TEXT NOT NULL,
		timestamp TEXT NOT NULL,
		session_id TEXT,
		project TEXT,
		success INTEGER DEFAULT 1,
		agent TEXT,
		event_id TEXT
	)`);
	db.run(`CREATE TABLE IF NOT EXISTS skill_daily_stats (
		date TEXT NOT NULL,
		skill_name TEXT NOT NULL,
		count INTEGER DEFAULT 0,
		UNIQUE(date, skill_name)
	)`);
	return db;
}

function skillPart(name: string, callID = "call_1") {
	return JSON.stringify({
		type: "tool",
		tool: "skill",
		callID,
		state: { status: "completed", input: { name } },
	});
}

function makeOpenCodeDb(
	parts: Array<{ session: string; data: string }>,
): string {
	const dataHome = mkdtempSync(join(tmpdir(), "skillkit-oc-data-"));
	const ocDir = join(dataHome, "opencode");
	mkdirSync(ocDir, { recursive: true });
	const dbPath = join(ocDir, "opencode.db");
	const ocDb = new Database(dbPath);
	ocDb.run("CREATE TABLE session (id TEXT PRIMARY KEY)");
	ocDb.run(`CREATE TABLE part (
		session_id TEXT NOT NULL,
		time_created INTEGER NOT NULL,
		data TEXT NOT NULL
	)`);
	const sessions = new Set(parts.map((p) => p.session));
	for (const id of sessions) {
		ocDb.run("INSERT INTO session (id) VALUES (?)", [id]);
	}
	for (const part of parts) {
		ocDb.run(
			"INSERT INTO part (session_id, time_created, data) VALUES (?, ?, ?)",
			[part.session, 1753142400000, part.data],
		);
	}
	ocDb.close();
	return dataHome;
}

describe("scanOpenCodeSessions / countOpenCodeSessions", () => {
	const originalXdg = process.env.XDG_DATA_HOME;

	afterEach(() => {
		if (originalXdg === undefined) {
			delete process.env.XDG_DATA_HOME;
		} else {
			process.env.XDG_DATA_HOME = originalXdg;
		}
	});

	it("records skill tool parts with skillName, agent, sessionId, eventId", () => {
		process.env.XDG_DATA_HOME = makeOpenCodeDb([
			{ session: "ses_1", data: skillPart("hatch-pet", "call_xyz") },
		]);
		const db = makeSkillkitDb();
		const total = scanOpenCodeSessions(db, new Set());
		expect(total).toBe(1);
		const rows = db
			.query<
				{
					skill_name: string;
					agent: string;
					session_id: string;
					event_id: string | null;
				},
				[]
			>("SELECT skill_name, agent, session_id, event_id FROM skill_invocations")
			.all();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.skill_name).toBe("hatch-pet");
		expect(rows[0]?.agent).toBe("opencode");
		expect(rows[0]?.session_id).toBe("oc:ses_1");
		expect(rows[0]?.event_id).toBe("call_xyz");
		expect(countOpenCodeSessions()).toBe(1);
		db.close();
	});

	it("returns zero invocations when parts have no skill usage", () => {
		process.env.XDG_DATA_HOME = makeOpenCodeDb([
			{
				session: "ses_2",
				data: JSON.stringify({
					type: "tool",
					tool: "bash",
					state: { input: { command: "ls" } },
				}),
			},
		]);
		const db = makeSkillkitDb();
		expect(scanOpenCodeSessions(db, new Set())).toBe(0);
		db.close();
	});

	it("tolerates corrupt JSON and malformed skill parts", () => {
		process.env.XDG_DATA_HOME = makeOpenCodeDb([
			{ session: "ses_3", data: '{"tool":"skill"' },
			{
				session: "ses_3",
				data: JSON.stringify({ type: "tool", tool: "skill" }),
			},
			{
				session: "ses_3",
				data: JSON.stringify({
					type: "tool",
					tool: "skill",
					state: { input: {} },
				}),
			},
			{ session: "ses_3", data: skillPart("survivor") },
		]);
		const db = makeSkillkitDb();
		expect(scanOpenCodeSessions(db, new Set())).toBe(1);
		db.close();
	});

	it("returns 0 when the opencode db is missing or corrupt", () => {
		const dataHome = mkdtempSync(join(tmpdir(), "skillkit-oc-missing-"));
		process.env.XDG_DATA_HOME = dataHome;
		const db = makeSkillkitDb();
		expect(scanOpenCodeSessions(db, new Set())).toBe(0);
		expect(countOpenCodeSessions()).toBe(0);

		const ocDir = join(dataHome, "opencode");
		mkdirSync(ocDir, { recursive: true });
		writeFileSync(join(ocDir, "opencode.db"), "not a sqlite database");
		expect(scanOpenCodeSessions(db, new Set())).toBe(0);
		expect(countOpenCodeSessions()).toBe(0);
		db.close();
	});
});
