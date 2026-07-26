import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	countAmpSessions,
	parseAmpSessionFile,
	scanAmpSessions,
} from "../scanner/connectors/amp";

const fixturesDir = join(import.meta.dir, "fixtures");
const fixtureThread = join(fixturesDir, "amp-thread.json");

function writeThread(thread: object, name = "T-test.json"): string {
	const dir = mkdtempSync(join(tmpdir(), "skillkit-amp-"));
	const file = join(dir, name);
	writeFileSync(file, JSON.stringify(thread));
	return file;
}

function toolUseMessage(
	name: string,
	input: Record<string, unknown>,
	timestamp = "2026-07-23T05:00:16.116Z",
) {
	return {
		role: "assistant",
		usage: { model: "gpt-5.6-sol", timestamp },
		content: [
			{
				id: "TU-1",
				name,
				type: "tool_use",
				input,
				complete: true,
			},
		],
	};
}

describe("parseAmpSessionFile", () => {
	it("extracts skills loaded via the native skill tool from the real fixture", () => {
		const out = parseAmpSessionFile(fixtureThread);
		const skillInvocations = out.filter((i) => i.skillName === "hello-world");
		expect(skillInvocations).toHaveLength(1);
		expect(skillInvocations[0]?.agent).toBe("amp");
		expect(skillInvocations[0]?.sessionId).toBe(
			"amp:T-019f8d5e-ae18-700d-80ae-d62f72a205c5",
		);
		expect(skillInvocations[0]?.timestamp).toBe("2026-07-23T05:00:16.116Z");
	});

	it("extracts skills read via SKILL.md path in shell_command args from the fixture", () => {
		const out = parseAmpSessionFile(fixtureThread);
		expect(out.map((i) => i.skillName)).toContain("deploy-helper");
	});

	it("uses the thread id from file content for the session id", () => {
		const file = writeThread({
			v: 1,
			id: "T-abc",
			created: 1784782809924,
			messages: [toolUseMessage("skill", { name: "my-skill" })],
		});
		const out = parseAmpSessionFile(file);
		expect(out[0]?.sessionId).toBe("amp:T-abc");
	});

	it("falls back to the filename when the thread has no id", () => {
		const file = writeThread(
			{
				v: 1,
				created: 1784782809924,
				messages: [toolUseMessage("skill", { name: "my-skill" })],
			},
			"T-noid.json",
		);
		const out = parseAmpSessionFile(file);
		expect(out[0]?.sessionId).toBe("amp:T-noid");
	});

	it("falls back to sentAt then thread created for timestamps", () => {
		const file = writeThread({
			v: 1,
			id: "T-ts",
			created: 1784782800000,
			messages: [
				{
					role: "assistant",
					meta: { sentAt: 1784782812215 },
					content: [{ type: "tool_use", name: "skill", input: { name: "a" } }],
				},
				{
					role: "assistant",
					content: [{ type: "tool_use", name: "skill", input: { name: "b" } }],
				},
			],
		});
		const out = parseAmpSessionFile(file);
		expect(out[0]?.timestamp).toBe(new Date(1784782812215).toISOString());
		expect(out[1]?.timestamp).toBe(new Date(1784782800000).toISOString());
	});

	it("counts non-internal tool calls only when in knownSkills", () => {
		const file = writeThread({
			v: 1,
			id: "T-known",
			created: 1784782809924,
			messages: [
				toolUseMessage("custom-skill", {}),
				toolUseMessage("other-tool", {}),
			],
		});
		expect(parseAmpSessionFile(file)).toEqual([]);
		const out = parseAmpSessionFile(file, new Set(["custom-skill"]));
		expect(out.map((i) => i.skillName)).toEqual(["custom-skill"]);
	});

	it("ignores internal amp tools even when in knownSkills", () => {
		const file = writeThread({
			v: 1,
			id: "T-internal",
			created: 1784782809924,
			messages: [
				toolUseMessage("shell_command", { command: "ls" }),
				toolUseMessage("oracle", { query: "review" }),
				toolUseMessage("mcp__linear__list_issues", {}),
			],
		});
		expect(
			parseAmpSessionFile(
				file,
				new Set(["shell_command", "oracle", "mcp__linear__list_issues"]),
			),
		).toEqual([]);
	});

	it("ignores non-assistant messages", () => {
		const file = writeThread({
			v: 1,
			id: "T-roles",
			created: 1784782809924,
			messages: [
				{
					role: "user",
					content: [
						{ type: "tool_use", name: "skill", input: { name: "nope" } },
					],
				},
			],
		});
		expect(parseAmpSessionFile(file)).toEqual([]);
	});

	it("returns empty for missing files, corrupt json, and malformed threads", () => {
		expect(parseAmpSessionFile("/nonexistent/T-x.json")).toEqual([]);

		const dir = mkdtempSync(join(tmpdir(), "skillkit-amp-"));
		const corrupt = join(dir, "T-corrupt.json");
		writeFileSync(corrupt, "{not json at all");
		expect(parseAmpSessionFile(corrupt)).toEqual([]);

		expect(parseAmpSessionFile(writeThread({ v: 1, id: "T-e" }))).toEqual([]);
		expect(
			parseAmpSessionFile(writeThread({ v: 1, id: "T-m", messages: "bad" })),
		).toEqual([]);
	});

	it("tolerates malformed messages and content blocks", () => {
		const file = writeThread({
			v: 1,
			id: "T-mal",
			created: 1784782809924,
			messages: [
				null,
				{ role: "assistant" },
				{ role: "assistant", content: "not-an-array" },
				{
					role: "assistant",
					content: [null, { type: "text", text: "hi" }, { type: "tool_use" }],
				},
				toolUseMessage("skill", { name: "survivor" }),
			],
		});
		const out = parseAmpSessionFile(file);
		expect(out.map((i) => i.skillName)).toEqual(["survivor"]);
	});

	it("ignores skill tool calls without a string name input", () => {
		const file = writeThread({
			v: 1,
			id: "T-badskill",
			created: 1784782809924,
			messages: [
				toolUseMessage("skill", {}),
				toolUseMessage("skill", { name: 3 }),
			],
		});
		expect(parseAmpSessionFile(file)).toEqual([]);
	});
});

describe("countAmpSessions / scanAmpSessions", () => {
	const originalXdg = process.env.XDG_DATA_HOME;

	afterEach(() => {
		if (originalXdg === undefined) {
			delete process.env.XDG_DATA_HOME;
		} else {
			process.env.XDG_DATA_HOME = originalXdg;
		}
	});

	function makeDataHome(withThreads: boolean): string {
		const dataHome = mkdtempSync(join(tmpdir(), "skillkit-amp-data-"));
		if (withThreads) {
			const threadsDir = join(dataHome, "amp", "threads");
			mkdirSync(threadsDir, { recursive: true });
			writeFileSync(
				join(threadsDir, "T-scan1.json"),
				JSON.stringify({
					v: 1,
					id: "T-scan1",
					created: 1784782809924,
					messages: [toolUseMessage("skill", { name: "hatch-pet" })],
				}),
			);
			writeFileSync(join(threadsDir, "T-corrupt.json"), "{broken");
		}
		return dataHome;
	}

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

	it("counts json thread files in XDG_DATA_HOME/amp/threads", () => {
		process.env.XDG_DATA_HOME = makeDataHome(true);
		expect(countAmpSessions()).toBe(2);
	});

	it("returns 0 when the threads dir does not exist", () => {
		process.env.XDG_DATA_HOME = makeDataHome(false);
		expect(countAmpSessions()).toBe(0);
	});

	it("scans threads, records invocations, and tolerates corrupt files", async () => {
		process.env.XDG_DATA_HOME = makeDataHome(true);
		const db = makeSkillkitDb();
		const tracked = new Set<string>();
		const total = await scanAmpSessions(db, tracked);
		expect(total).toBe(1);
		const rows = db
			.query<{ skill_name: string; agent: string; session_id: string }, []>(
				"SELECT skill_name, agent, session_id FROM skill_invocations",
			)
			.all();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.skill_name).toBe("hatch-pet");
		expect(rows[0]?.agent).toBe("amp");
		expect(rows[0]?.session_id).toBe("amp:T-scan1");
		db.close();
	});

	it("skips invocations already tracked", async () => {
		process.env.XDG_DATA_HOME = makeDataHome(true);
		const db = makeSkillkitDb();
		const tracked = new Set<string>();
		expect(await scanAmpSessions(db, tracked)).toBe(1);
		expect(await scanAmpSessions(db, tracked)).toBe(0);
		db.close();
	});

	it("returns 0 when scanning a missing dir", async () => {
		process.env.XDG_DATA_HOME = makeDataHome(false);
		const db = makeSkillkitDb();
		expect(await scanAmpSessions(db, new Set())).toBe(0);
		db.close();
	});
});
