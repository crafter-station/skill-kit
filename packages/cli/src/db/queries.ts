import type { Database } from "bun:sqlite";

interface TopSkillRow {
	skill_name: string;
	total: number;
}

interface StatsRow {
	total: number;
	unique_skills: number;
}

interface DailyRow {
	date: string;
	count: number;
}

interface InstalledSkillRow {
	name: string;
	path: string;
	installed_at: string;
	source: string | null;
	version: string | null;
	size_bytes: number | null;
}

export function getTopSkills(
	db: Database,
	days = 30,
	limit?: number,
	agent?: string,
): TopSkillRow[] {
	const cutoff = new Date(
		Date.now() - days * 24 * 60 * 60 * 1000,
	).toISOString();
	const agentClause = agent ? " AND agent = ?" : "";
	const params = agent ? [cutoff, agent] : [cutoff];
	const limitClause = limit ? ` LIMIT ${limit}` : "";
	const sql = `SELECT skill_name, COUNT(*) as total FROM skill_invocations WHERE timestamp >= ?${agentClause} GROUP BY skill_name ORDER BY total DESC${limitClause}`;
	return db.query<TopSkillRow, string[]>(sql).all(...params);
}

export function getSkillStats(db: Database, days = 30, agent?: string): StatsRow {
	const cutoff = new Date(
		Date.now() - days * 24 * 60 * 60 * 1000,
	).toISOString();
	const agentClause = agent ? " AND agent = ?" : "";
	const params = agent ? [cutoff, agent] : [cutoff];
	return (
		db
			.query<StatsRow, string[]>(
				`SELECT COUNT(*) as total, COUNT(DISTINCT skill_name) as unique_skills FROM skill_invocations WHERE timestamp >= ?${agentClause}`,
			)
			.get(...params) ?? { total: 0, unique_skills: 0 }
	);
}

export function getDailyUsage(
	db: Database,
	skillName: string,
	days = 30,
	agent?: string,
): DailyRow[] {
	const cutoff = new Date(
		Date.now() - days * 24 * 60 * 60 * 1000,
	).toISOString();
	const agentClause = agent ? " AND agent = ?" : "";
	const params = agent ? [skillName, cutoff, agent] : [skillName, cutoff];
	return db
		.query<DailyRow, string[]>(
			`SELECT date(timestamp) as date, COUNT(*) as count FROM skill_invocations WHERE skill_name = ? AND timestamp >= ?${agentClause} GROUP BY date(timestamp) ORDER BY date ASC`,
		)
		.all(...params);
}

export function getInstalledSkills(db: Database): InstalledSkillRow[] {
	return db
		.query<InstalledSkillRow, []>(
			"SELECT * FROM installed_skills ORDER BY name ASC",
		)
		.all();
}

export function recordInvocation(
	db: Database,
	skillName: string,
	sessionId?: string,
	project?: string,
	timestamp?: string,
	agent?: string,
): void {
	const ts = timestamp ?? new Date().toISOString();
	db.run(
		"INSERT INTO skill_invocations (skill_name, timestamp, session_id, project, agent) VALUES (?, ?, ?, ?, ?)",
		[skillName, ts, sessionId ?? null, project ?? null, agent ?? null],
	);
	const date = ts.slice(0, 10);
	db.run(
		"INSERT INTO skill_daily_stats (date, skill_name, count) VALUES (?, ?, 1) ON CONFLICT(date, skill_name) DO UPDATE SET count = count + 1",
		[date, skillName],
	);
}

export function deduplicateInvocations(db: Database): number {
	const before = db
		.query<{ count: number }, []>(
			"SELECT COUNT(*) as count FROM skill_invocations",
		)
		.get()?.count ?? 0;

	db.run(`
		DELETE FROM skill_invocations WHERE id NOT IN (
			SELECT MIN(id) FROM skill_invocations
			GROUP BY skill_name, session_id, timestamp
		)
	`);

	const after = db
		.query<{ count: number }, []>(
			"SELECT COUNT(*) as count FROM skill_invocations",
		)
		.get()?.count ?? 0;

	if (before !== after) {
		db.run("DELETE FROM skill_daily_stats");
		db.run(`
			INSERT INTO skill_daily_stats (date, skill_name, count)
			SELECT date(timestamp), skill_name, COUNT(*)
			FROM skill_invocations
			GROUP BY date(timestamp), skill_name
		`);
	}

	return before - after;
}

export function upsertInstalledSkill(
	db: Database,
	name: string,
	path: string,
	source?: string,
	version?: string,
	sizeBytes?: number,
): void {
	db.run(
		"INSERT INTO installed_skills (name, path, installed_at, source, version, size_bytes) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET path = excluded.path, source = excluded.source, version = excluded.version, size_bytes = excluded.size_bytes",
		[
			name,
			path,
			new Date().toISOString(),
			source ?? null,
			version ?? null,
			sizeBytes ?? null,
		],
	);
}
