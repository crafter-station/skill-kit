import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	extractGooseInvocations,
	parseGooseSessionFile,
	scanGooseDb,
} from "../scanner/connectors/goose";

function toolRequestContent(
	name: string,
	args: Record<string, unknown> = {},
	id = "call_1",
) {
	return {
		type: "toolRequest",
		id,
		toolCall: {
			status: "success",
			value: { name, arguments: args },
		},
	};
}

describe("extractGooseInvocations", () => {
	it("extracts skills loaded via skills__load_skill", () => {
		const content = JSON.stringify([
			toolRequestContent("skills__load_skill", { name: "hatch-pet" }),
		]);
		const out = extractGooseInvocations(
			"goose:s1",
			"assistant",
			content,
			"2026-07-18T00:00:00.000Z",
		);
		expect(out.map((i) => i.skillName)).toEqual(["hatch-pet"]);
		expect(out[0]?.agent).toBe("goose");
		expect(out[0]?.sessionId).toBe("goose:s1");
	});

	it("strips supporting file suffix from load_skill name", () => {
		const content = JSON.stringify([
			toolRequestContent("skills__load_skill", {
				name: "hatch-pet/template.md",
			}),
		]);
		const out = extractGooseInvocations(
			"goose:s1",
			"assistant",
			content,
			"2026-07-18T00:00:00.000Z",
		);
		expect(out.map((i) => i.skillName)).toEqual(["hatch-pet"]);
	});

	it("extracts skills read via SKILL.md path in shell arguments", () => {
		const content = JSON.stringify([
			toolRequestContent("developer__shell", {
				command: "cat /Users/x/.config/goose/skills/my-skill/SKILL.md",
			}),
		]);
		const out = extractGooseInvocations(
			"goose:s1",
			"assistant",
			content,
			"2026-07-18T00:00:00.000Z",
		);
		expect(out.map((i) => i.skillName)).toEqual(["my-skill"]);
	});

	it("counts extension tools only when name is in knownSkills", () => {
		const content = JSON.stringify([
			toolRequestContent("custom__my-skill", {}),
			toolRequestContent("custom__other", {}),
		]);
		expect(
			extractGooseInvocations("goose:s1", "assistant", content, "t"),
		).toEqual([]);
		const out = extractGooseInvocations(
			"goose:s1",
			"assistant",
			content,
			"2026-07-18T00:00:00.000Z",
			new Set(["my-skill"]),
		);
		expect(out.map((i) => i.skillName)).toEqual(["my-skill"]);
	});

	it("ignores internal goose tools even when in knownSkills", () => {
		const content = JSON.stringify([
			toolRequestContent("developer__shell", { command: "ls" }),
			toolRequestContent("developer__text_editor", { path: "/tmp/a" }),
		]);
		expect(
			extractGooseInvocations(
				"goose:s1",
				"assistant",
				content,
				"2026-07-18T00:00:00.000Z",
				new Set(["shell", "text_editor", "developer__shell"]),
			),
		).toEqual([]);
	});

	it("ignores non-assistant roles", () => {
		const content = JSON.stringify([
			toolRequestContent("skills__load_skill", { name: "hatch-pet" }),
		]);
		expect(extractGooseInvocations("goose:s1", "user", content, "t")).toEqual(
			[],
		);
	});

	it("returns empty on corrupt or non-array content", () => {
		expect(
			extractGooseInvocations("goose:s1", "assistant", "{not json", "t"),
		).toEqual([]);
		expect(
			extractGooseInvocations("goose:s1", "assistant", '{"a":1}', "t"),
		).toEqual([]);
	});

	it("tolerates malformed content blocks", () => {
		const content = JSON.stringify([
			null,
			{ type: "text", text: "hi" },
			{ type: "toolRequest" },
			{ type: "toolRequest", toolCall: { status: "error", error: "boom" } },
			toolRequestContent("skills__load_skill", { name: "hatch-pet" }),
		]);
		const out = extractGooseInvocations(
			"goose:s1",
			"assistant",
			content,
			"2026-07-18T00:00:00.000Z",
		);
		expect(out.map((i) => i.skillName)).toEqual(["hatch-pet"]);
	});
});

describe("parseGooseSessionFile (legacy jsonl)", () => {
	function writeLegacySession(lines: object[]): string {
		const dir = mkdtempSync(join(tmpdir(), "skillkit-goose-"));
		const file = join(dir, "20260718_120000.jsonl");
		writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n"));
		return file;
	}

	it("skips the metadata line and extracts load_skill calls", () => {
		const file = writeLegacySession([
			{ description: "session meta", working_dir: "/tmp" },
			{
				role: "assistant",
				created: 1784332800,
				content: [
					toolRequestContent("skills__load_skill", { name: "hatch-pet" }),
				],
			},
		]);
		const out = parseGooseSessionFile(file);
		expect(out.map((i) => i.skillName)).toEqual(["hatch-pet"]);
		expect(out[0]?.sessionId).toBe("goose:20260718_120000");
		expect(out[0]?.timestamp).toBe("2026-07-18T00:00:00.000Z");
	});

	it("normalizes millisecond timestamps", () => {
		const file = writeLegacySession([
			{},
			{
				role: "assistant",
				created: 1784332800000,
				content: [toolRequestContent("skills__load_skill", { name: "s" })],
			},
		]);
		const out = parseGooseSessionFile(file);
		expect(out[0]?.timestamp).toBe("2026-07-18T00:00:00.000Z");
	});

	it("returns empty on missing file", () => {
		expect(parseGooseSessionFile("/nonexistent/nope.jsonl")).toEqual([]);
	});

	it("tolerates corrupt lines", () => {
		const dir = mkdtempSync(join(tmpdir(), "skillkit-goose-"));
		const file = join(dir, "bad.jsonl");
		writeFileSync(
			file,
			[
				"{meta broken",
				"{not json",
				JSON.stringify({
					role: "assistant",
					created: 1784332800,
					content: [
						toolRequestContent("skills__load_skill", { name: "hatch-pet" }),
					],
				}),
			].join("\n"),
		);
		const out = parseGooseSessionFile(file);
		expect(out.map((i) => i.skillName)).toEqual(["hatch-pet"]);
	});
});

describe("scanGooseDb (sqlite)", () => {
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

	function makeGooseDb(): string {
		const dir = mkdtempSync(join(tmpdir(), "skillkit-goose-db-"));
		const dbPath = join(dir, "sessions.db");
		const gooseDb = new Database(dbPath);
		gooseDb.run(`CREATE TABLE sessions (
			id TEXT PRIMARY KEY,
			working_dir TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`);
		gooseDb.run(`CREATE TABLE messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			message_id TEXT,
			session_id TEXT NOT NULL REFERENCES sessions(id),
			role TEXT NOT NULL,
			content_json TEXT NOT NULL,
			created_timestamp INTEGER NOT NULL,
			timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			tokens INTEGER,
			metadata_json TEXT
		)`);
		gooseDb.run("INSERT INTO sessions (id, working_dir) VALUES ('s1', '/tmp')");
		gooseDb.run(
			"INSERT INTO messages (session_id, role, content_json, created_timestamp) VALUES (?, ?, ?, ?)",
			[
				"s1",
				"assistant",
				JSON.stringify([
					toolRequestContent("skills__load_skill", { name: "hatch-pet" }),
				]),
				1784332800,
			],
		);
		gooseDb.run(
			"INSERT INTO messages (session_id, role, content_json, created_timestamp) VALUES (?, ?, ?, ?)",
			[
				"s1",
				"assistant",
				JSON.stringify([
					toolRequestContent("developer__shell", { command: "ls" }),
				]),
				1784332900,
			],
		);
		gooseDb.run(
			"INSERT INTO messages (session_id, role, content_json, created_timestamp) VALUES (?, ?, ?, ?)",
			["s1", "user", "[]", 1784332700],
		);
		gooseDb.close();
		return dbPath;
	}

	it("records load_skill invocations from the messages table", () => {
		const dbPath = makeGooseDb();
		const db = makeSkillkitDb();
		const total = scanGooseDb(dbPath, db, new Set());
		expect(total).toBe(1);
		const rows = db
			.query<{ skill_name: string; agent: string; session_id: string }, []>(
				"SELECT skill_name, agent, session_id FROM skill_invocations",
			)
			.all();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.skill_name).toBe("hatch-pet");
		expect(rows[0]?.agent).toBe("goose");
		expect(rows[0]?.session_id).toBe("goose:s1");
		db.close();
	});

	it("skips invocations already tracked", () => {
		const dbPath = makeGooseDb();
		const db = makeSkillkitDb();
		const tracked = new Set<string>();
		expect(scanGooseDb(dbPath, db, tracked)).toBe(1);
		expect(scanGooseDb(dbPath, db, tracked)).toBe(0);
		db.close();
	});

	it("returns 0 for a missing db path", () => {
		const db = makeSkillkitDb();
		expect(scanGooseDb("/nonexistent/sessions.db", db, new Set())).toBe(0);
		db.close();
	});

	it("returns 0 for a corrupt db file", () => {
		const dir = mkdtempSync(join(tmpdir(), "skillkit-goose-db-"));
		const dbPath = join(dir, "sessions.db");
		writeFileSync(dbPath, "not a sqlite database at all");
		const db = makeSkillkitDb();
		expect(scanGooseDb(dbPath, db, new Set())).toBe(0);
		db.close();
	});
});
