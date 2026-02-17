import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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
			success INTEGER DEFAULT 1
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
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_invocations_skill ON skill_invocations(skill_name)",
	);
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_invocations_ts ON skill_invocations(timestamp DESC)",
	);
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_daily_date ON skill_daily_stats(date DESC)",
	);
	return db;
}
