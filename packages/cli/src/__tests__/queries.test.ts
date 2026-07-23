import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import {
	deduplicateInvocations,
	getCurrentStreak,
	getDailyUsageRows,
	getInstalledSkills,
	getSkillStats,
	getTopSkills,
	getWeeklyVelocity,
	recordInvocation,
	upsertDailyUsage,
	upsertInstalledSkill,
} from "../db/queries";

function makeDb(): Database {
	const db = new Database(":memory:");
	db.run(`CREATE TABLE IF NOT EXISTS skill_invocations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		skill_name TEXT NOT NULL,
		timestamp TEXT NOT NULL,
		session_id TEXT,
		project TEXT,
		success INTEGER DEFAULT 1,
		agent TEXT
	)`);
	db.run(`CREATE TABLE IF NOT EXISTS skill_daily_stats (
		date TEXT NOT NULL,
		skill_name TEXT NOT NULL,
		count INTEGER DEFAULT 0,
		UNIQUE(date, skill_name)
	)`);
	db.run(`CREATE TABLE IF NOT EXISTS installed_skills (
		name TEXT PRIMARY KEY,
		path TEXT NOT NULL,
		installed_at TEXT NOT NULL,
		source TEXT,
		version TEXT,
		size_bytes INTEGER
	)`);
	db.run(`CREATE TABLE IF NOT EXISTS daily_usage (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		date TEXT NOT NULL,
		agent TEXT NOT NULL,
		input_tokens INTEGER DEFAULT 0,
		output_tokens INTEGER DEFAULT 0,
		cache_creation_tokens INTEGER DEFAULT 0,
		cache_read_tokens INTEGER DEFAULT 0,
		total_tokens INTEGER DEFAULT 0,
		cost_usd REAL DEFAULT 0,
		session_count INTEGER DEFAULT 0,
		models TEXT,
		model_breakdown TEXT,
		UNIQUE(date, agent)
	)`);
	return db;
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
	return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

describe("daily_usage", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("upserts and retrieves rows", () => {
		upsertDailyUsage(
			db,
			daysAgo(2),
			"claude",
			1000,
			5000,
			200,
			100,
			6300,
			1.5,
			3,
			["claude-opus-4"],
			{},
		);
		upsertDailyUsage(
			db,
			daysAgo(2),
			"cursor",
			500,
			2000,
			0,
			0,
			2500,
			0.3,
			1,
			["gpt-4o"],
			{},
		);

		const rows = getDailyUsageRows(db, 30);
		expect(rows).toHaveLength(2);
		expect(rows.find((r) => r.agent === "claude")?.cost_usd).toBe(1.5);
		expect(rows.find((r) => r.agent === "cursor")?.output_tokens).toBe(2000);
	});

	it("upsert replaces on conflict", () => {
		upsertDailyUsage(
			db,
			daysAgo(2),
			"claude",
			1000,
			5000,
			0,
			0,
			6000,
			1.0,
			1,
			[],
			{},
		);
		upsertDailyUsage(
			db,
			daysAgo(2),
			"claude",
			2000,
			10000,
			0,
			0,
			12000,
			2.5,
			2,
			[],
			{},
		);

		const rows = getDailyUsageRows(db, 30);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.cost_usd).toBe(2.5);
		expect(rows[0]?.input_tokens).toBe(2000);
	});

	it("filters by agent", () => {
		upsertDailyUsage(
			db,
			daysAgo(2),
			"claude",
			1000,
			5000,
			0,
			0,
			6000,
			1.0,
			1,
			[],
			{},
		);
		upsertDailyUsage(
			db,
			daysAgo(2),
			"cursor",
			500,
			2000,
			0,
			0,
			2500,
			0.3,
			1,
			[],
			{},
		);

		const claude = getDailyUsageRows(db, 30, "claude");
		expect(claude).toHaveLength(1);
		expect(claude[0]?.agent).toBe("claude");

		const cursor = getDailyUsageRows(db, 30, "cursor");
		expect(cursor).toHaveLength(1);
		expect(cursor[0]?.agent).toBe("cursor");
	});

	it("respects day cutoff", () => {
		upsertDailyUsage(
			db,
			daysAgo(5),
			"claude",
			100,
			500,
			0,
			0,
			600,
			0.1,
			1,
			[],
			{},
		);
		upsertDailyUsage(
			db,
			daysAgo(40),
			"claude",
			100,
			500,
			0,
			0,
			600,
			0.1,
			1,
			[],
			{},
		);

		expect(getDailyUsageRows(db, 30)).toHaveLength(1);
		expect(getDailyUsageRows(db, 60)).toHaveLength(2);
	});
});

describe("streak", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("returns 0 for empty db", () => {
		const s = getCurrentStreak(db);
		expect(s.current).toBe(0);
		expect(s.longest).toBe(0);
	});

	it("counts consecutive days from today", () => {
		for (let i = 0; i < 5; i++) {
			upsertDailyUsage(
				db,
				daysAgo(i),
				"claude",
				100,
				500,
				0,
				0,
				600,
				0.1,
				1,
				[],
				{},
			);
		}
		const s = getCurrentStreak(db);
		expect(s.current).toBe(5);
		expect(s.longest).toBe(5);
	});

	it("breaks streak on gap", () => {
		upsertDailyUsage(
			db,
			daysAgo(0),
			"claude",
			100,
			500,
			0,
			0,
			600,
			0.1,
			1,
			[],
			{},
		);
		upsertDailyUsage(
			db,
			daysAgo(1),
			"claude",
			100,
			500,
			0,
			0,
			600,
			0.1,
			1,
			[],
			{},
		);
		upsertDailyUsage(
			db,
			daysAgo(5),
			"claude",
			100,
			500,
			0,
			0,
			600,
			0.1,
			1,
			[],
			{},
		);
		upsertDailyUsage(
			db,
			daysAgo(6),
			"claude",
			100,
			500,
			0,
			0,
			600,
			0.1,
			1,
			[],
			{},
		);
		upsertDailyUsage(
			db,
			daysAgo(7),
			"claude",
			100,
			500,
			0,
			0,
			600,
			0.1,
			1,
			[],
			{},
		);

		const s = getCurrentStreak(db);
		expect(s.current).toBe(2);
		expect(s.longest).toBe(3);
	});

	it("current streak is 0 if last activity was >1 day ago", () => {
		upsertDailyUsage(
			db,
			daysAgo(3),
			"claude",
			100,
			500,
			0,
			0,
			600,
			0.1,
			1,
			[],
			{},
		);
		upsertDailyUsage(
			db,
			daysAgo(4),
			"claude",
			100,
			500,
			0,
			0,
			600,
			0.1,
			1,
			[],
			{},
		);

		const s = getCurrentStreak(db);
		expect(s.current).toBe(0);
		expect(s.longest).toBe(2);
	});

	it("multi-agent days count once", () => {
		upsertDailyUsage(
			db,
			daysAgo(0),
			"claude",
			100,
			500,
			0,
			0,
			600,
			0.1,
			1,
			[],
			{},
		);
		upsertDailyUsage(
			db,
			daysAgo(0),
			"cursor",
			50,
			200,
			0,
			0,
			250,
			0.05,
			1,
			[],
			{},
		);
		upsertDailyUsage(
			db,
			daysAgo(1),
			"claude",
			100,
			500,
			0,
			0,
			600,
			0.1,
			1,
			[],
			{},
		);

		const s = getCurrentStreak(db);
		expect(s.current).toBe(2);
	});
});

describe("velocity", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("returns zeros for empty db", () => {
		const v = getWeeklyVelocity(db);
		expect(v.thisWeek).toBe(0);
		expect(v.lastWeek).toBe(0);
		expect(v.change).toBe(0);
	});

	it("sums cost for current week", () => {
		upsertDailyUsage(
			db,
			today(),
			"claude",
			100,
			500,
			0,
			0,
			600,
			5.0,
			1,
			[],
			{},
		);
		const v = getWeeklyVelocity(db);
		expect(v.thisWeek).toBeGreaterThanOrEqual(5.0);
	});
});

describe("skill_invocations (existing)", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("records and retrieves invocations", () => {
		recordInvocation(
			db,
			"clerk",
			"sess1",
			"proj1",
			`${daysAgo(2)}T10:00:00Z`,
			"claude",
		);
		recordInvocation(
			db,
			"clerk",
			"sess2",
			"proj1",
			`${daysAgo(2)}T11:00:00Z`,
			"claude",
		);
		recordInvocation(
			db,
			"resend",
			"sess3",
			"proj2",
			`${daysAgo(2)}T12:00:00Z`,
			"cursor",
		);

		const top = getTopSkills(db, 30);
		expect(top[0]?.skill_name).toBe("clerk");
		expect(top[0]?.total).toBe(2);
	});

	it("getSkillStats counts correctly", () => {
		recordInvocation(
			db,
			"clerk",
			"s1",
			null,
			`${daysAgo(2)}T10:00:00Z`,
			"claude",
		);
		recordInvocation(
			db,
			"resend",
			"s2",
			null,
			`${daysAgo(2)}T11:00:00Z`,
			"claude",
		);

		const stats = getSkillStats(db, 30);
		expect(stats.total).toBe(2);
		expect(stats.unique_skills).toBe(2);
	});

	it("filters by agent", () => {
		recordInvocation(
			db,
			"clerk",
			"s1",
			null,
			`${daysAgo(2)}T10:00:00Z`,
			"claude",
		);
		recordInvocation(
			db,
			"clerk",
			"s2",
			null,
			`${daysAgo(2)}T11:00:00Z`,
			"cursor",
		);

		expect(getTopSkills(db, 30, undefined, "claude")).toHaveLength(1);
		expect(getTopSkills(db, 30, undefined, "cursor")).toHaveLength(1);
	});

	it("deduplicates invocations", () => {
		recordInvocation(
			db,
			"clerk",
			"s1",
			null,
			`${daysAgo(2)}T10:00:00Z`,
			"claude",
		);
		recordInvocation(
			db,
			"clerk",
			"s1",
			null,
			`${daysAgo(2)}T10:00:00Z`,
			"claude",
		);
		recordInvocation(
			db,
			"clerk",
			"s1",
			null,
			`${daysAgo(2)}T10:00:00Z`,
			"claude",
		);

		const removed = deduplicateInvocations(db);
		expect(removed).toBe(2);
		expect(getSkillStats(db, 30).total).toBe(1);
	});
});

describe("installed_skills (existing)", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("upserts and lists skills", () => {
		upsertInstalledSkill(db, "clerk", "/path/clerk", "global", "1.0.0", 2048);
		upsertInstalledSkill(
			db,
			"resend",
			"/path/resend",
			"project",
			"0.5.0",
			1024,
		);

		const skills = getInstalledSkills(db);
		expect(skills).toHaveLength(2);
		expect(skills[0]?.name).toBe("clerk");
	});

	it("updates on conflict", () => {
		upsertInstalledSkill(db, "clerk", "/old", "global", "1.0.0", 1000);
		upsertInstalledSkill(db, "clerk", "/new", "global", "2.0.0", 2000);

		const skills = getInstalledSkills(db);
		expect(skills).toHaveLength(1);
		expect(skills[0]?.path).toBe("/new");
		expect(skills[0]?.version).toBe("2.0.0");
	});
});
