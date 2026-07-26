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

// Callers pass null for "no session / no project / no agent" as readily as
// they omit the argument, and the body already normalizes both to SQL NULL.
export function recordInvocation(
	db: Database,
	skillName: string,
	sessionId?: string | null,
	project?: string | null,
	timestamp?: string | null,
	agent?: string | null,
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

export interface DailyUsageRow {
	id: number;
	date: string;
	agent: string;
	input_tokens: number;
	output_tokens: number;
	cache_creation_tokens: number;
	cache_read_tokens: number;
	total_tokens: number;
	cost_usd: number;
	session_count: number;
	models: string | null;
	model_breakdown: string | null;
}

export function upsertDailyUsage(
	db: Database,
	date: string,
	agent: string,
	inputTokens: number,
	outputTokens: number,
	cacheCreationTokens: number,
	cacheReadTokens: number,
	totalTokens: number,
	costUsd: number,
	sessionCount: number,
	models: string[],
	modelBreakdown: Record<string, { apiCalls: number; costUsd: number }>,
): void {
	db.run(
		`INSERT INTO daily_usage (date, agent, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, total_tokens, cost_usd, session_count, models, model_breakdown)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date, agent) DO UPDATE SET
       input_tokens = excluded.input_tokens,
       output_tokens = excluded.output_tokens,
       cache_creation_tokens = excluded.cache_creation_tokens,
       cache_read_tokens = excluded.cache_read_tokens,
       total_tokens = excluded.total_tokens,
       cost_usd = excluded.cost_usd,
       session_count = excluded.session_count,
       models = excluded.models,
       model_breakdown = excluded.model_breakdown`,
		[
			date,
			agent,
			inputTokens,
			outputTokens,
			cacheCreationTokens,
			cacheReadTokens,
			totalTokens,
			costUsd,
			sessionCount,
			JSON.stringify(models),
			JSON.stringify(modelBreakdown),
		],
	);
}

export function getDailyUsageRows(
	db: Database,
	days = 30,
	agent?: string,
): DailyUsageRow[] {
	const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
		.toISOString()
		.slice(0, 10);
	const agentClause = agent ? " AND agent = ?" : "";
	const params = agent ? [cutoff, agent] : [cutoff];
	return db
		.query<DailyUsageRow, string[]>(
			`SELECT * FROM daily_usage WHERE date >= ?${agentClause} ORDER BY date DESC`,
		)
		.all(...params);
}

export function getCurrentStreak(
	db: Database,
	agent?: string,
): { current: number; longest: number } {
	const agentClause = agent ? " WHERE agent = ?" : "";
	const params = agent ? [agent] : [];
	const rows = db
		.query<{ date: string }, string[]>(
			`SELECT DISTINCT date FROM daily_usage${agentClause} ORDER BY date DESC`,
		)
		.all(...params);

	if (rows.length === 0) return { current: 0, longest: 0 };

	const today = new Date().toISOString().slice(0, 10);
	const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

	let current = 0;
	let longest = 0;
	let streak = 0;
	let prevDate: Date | null = null;

	for (const row of rows) {
		const d = new Date(row.date + "T12:00:00");
		if (prevDate === null) {
			if (row.date !== today && row.date !== yesterday) {
				current = 0;
				streak = 1;
			} else {
				streak = 1;
			}
		} else {
			const diff = (prevDate.getTime() - d.getTime()) / 86400000;
			if (Math.abs(diff - 1) < 0.5) {
				streak++;
			} else {
				if (
					current === 0 &&
					(rows[0]!.date === today || rows[0]!.date === yesterday)
				) {
					current = streak;
				}
				longest = Math.max(longest, streak);
				streak = 1;
			}
		}
		prevDate = d;
	}

	if (current === 0 && (rows[0]!.date === today || rows[0]!.date === yesterday)) {
		current = streak;
	}
	longest = Math.max(longest, streak);

	return { current, longest };
}

export function getWeeklyVelocity(
	db: Database,
	agent?: string,
): { thisWeek: number; lastWeek: number; change: number } {
	const now = new Date();
	const startOfThisWeek = new Date(now);
	startOfThisWeek.setDate(now.getDate() - now.getDay());
	const startOfLastWeek = new Date(startOfThisWeek);
	startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

	const thisWeekStr = startOfThisWeek.toISOString().slice(0, 10);
	const lastWeekStr = startOfLastWeek.toISOString().slice(0, 10);
	const todayStr = now.toISOString().slice(0, 10);

	const agentClause = agent ? " AND agent = ?" : "";

	const thisWeekParams = agent
		? [thisWeekStr, todayStr, agent]
		: [thisWeekStr, todayStr];
	const thisWeekRow = db
		.query<{ total: number }, string[]>(
			`SELECT COALESCE(SUM(cost_usd), 0) as total FROM daily_usage WHERE date >= ? AND date <= ?${agentClause}`,
		)
		.get(...thisWeekParams);

	const lastWeekParams = agent
		? [lastWeekStr, thisWeekStr, agent]
		: [lastWeekStr, thisWeekStr];
	const lastWeekRow = db
		.query<{ total: number }, string[]>(
			`SELECT COALESCE(SUM(cost_usd), 0) as total FROM daily_usage WHERE date >= ? AND date < ?${agentClause}`,
		)
		.get(...lastWeekParams);

	const thisWeek = thisWeekRow?.total ?? 0;
	const lastWeek = lastWeekRow?.total ?? 0;
	const change = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;

	return { thisWeek, lastWeek, change };
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
