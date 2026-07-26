import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ensureConflictTable } from "../conflicts/store";
import { ensureTraceTable } from "../trace/store";

const DB_DIR = join(homedir(), ".skillkit");
const DB_PATH = join(DB_DIR, "analytics.db");

export function getDb(): Database {
	mkdirSync(DB_DIR, { recursive: true });
	const db = new Database(DB_PATH);
	db.run("PRAGMA journal_mode=WAL");
	db.run(`
		CREATE TABLE IF NOT EXISTS skill_invocations (
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
		CREATE TABLE IF NOT EXISTS skill_daily_stats (
			date TEXT NOT NULL,
			skill_name TEXT NOT NULL,
			count INTEGER DEFAULT 0,
			UNIQUE(date, skill_name)
		)
	`);
	db.run(`
		CREATE TABLE IF NOT EXISTS installed_skills (
			name TEXT PRIMARY KEY,
			path TEXT NOT NULL,
			installed_at TEXT NOT NULL,
			source TEXT,
			version TEXT,
			size_bytes INTEGER
		)
	`);
	try {
		db.run("ALTER TABLE skill_invocations ADD COLUMN agent TEXT");
	} catch {}
	try {
		db.run("ALTER TABLE skill_invocations ADD COLUMN event_id TEXT");
	} catch {}
	try {
		db.run(
			"UPDATE skill_invocations SET agent = 'opencode' WHERE (agent IS NULL OR agent = '') AND session_id LIKE 'oc:%'",
		);
		db.run(
			"UPDATE skill_invocations SET agent = 'codex' WHERE (agent IS NULL OR agent = '') AND session_id LIKE 'codex:%'",
		);
		db.run(
			"UPDATE skill_invocations SET agent = 'cursor' WHERE (agent IS NULL OR agent = '') AND session_id LIKE 'cursor:%'",
		);
		db.run(
			"UPDATE skill_invocations SET agent = 'gemini' WHERE (agent IS NULL OR agent = '') AND session_id LIKE 'gemini:%'",
		);
		db.run(
			"UPDATE skill_invocations SET agent = 'claude' WHERE (agent IS NULL OR agent = '') AND session_id IS NOT NULL",
		);
	} catch {}
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_invocations_agent ON skill_invocations(agent)",
	);
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_invocations_skill ON skill_invocations(skill_name)",
	);
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_invocations_ts ON skill_invocations(timestamp DESC)",
	);
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_daily_date ON skill_daily_stats(date DESC)",
	);
	db.run(`
		CREATE TABLE IF NOT EXISTS daily_usage (
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
		)
	`);
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON daily_usage(date DESC)",
	);
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_daily_usage_agent ON daily_usage(agent)",
	);
	ensureTraceTable(db);
	ensureConflictTable(db);
	deduplicateInvocations(db);
	return db;
}

function deduplicateInvocations(db: Database): void {
	try {
		db.run(
			`DELETE FROM skill_invocations WHERE skill_name LIKE 'mcp_%' OR skill_name LIKE 'mcp__%' OR skill_name = 'update_plan'`,
		);

		const row = db
			.query<{ dupes: number }, []>(
				`SELECT COUNT(*) - COUNT(DISTINCT skill_name || '::' || REPLACE(timestamp, SUBSTR(timestamp, -5, 4), '')) as dupes FROM skill_invocations`,
			)
			.get();
		if (row && row.dupes > 0) {
			db.run(`
				DELETE FROM skill_invocations WHERE rowid NOT IN (
					SELECT MIN(rowid) FROM skill_invocations
					GROUP BY skill_name, REPLACE(timestamp, SUBSTR(timestamp, -5, 4), '')
				)
			`);
		}
	} catch {
		/* empty */
	}
}
