import type { Database } from "bun:sqlite";
import type { CollisionResult } from "./analyzer";

export interface ConflictRow {
	id: number;
	conflict_id: string;
	probe_prompt: string;
	probe_type: string;
	expected_skill: string;
	actual_skill: string | null;
	result_type: string;
	pair_skills: string | null;
	timestamp: string;
}

export function ensureConflictTable(db: Database): void {
	db.run(`
		CREATE TABLE IF NOT EXISTS skill_conflicts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			conflict_id TEXT NOT NULL,
			probe_prompt TEXT NOT NULL,
			probe_type TEXT NOT NULL,
			expected_skill TEXT NOT NULL,
			actual_skill TEXT,
			result_type TEXT NOT NULL,
			pair_skills TEXT,
			timestamp TEXT NOT NULL
		)
	`);
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_conflicts_ts ON skill_conflicts(timestamp DESC)",
	);
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_conflicts_id ON skill_conflicts(conflict_id)",
	);
}

export function saveConflictResults(
	db: Database,
	results: CollisionResult[],
): string {
	const conflictId = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
	const ts = new Date().toISOString();

	const stmt = db.prepare(
		`INSERT INTO skill_conflicts (conflict_id, probe_prompt, probe_type, expected_skill, actual_skill, result_type, pair_skills, timestamp)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	);

	for (const r of results) {
		stmt.run(
			conflictId,
			r.probe.prompt,
			r.probe.type,
			r.probe.expectedSkill,
			r.firedSkill,
			r.type,
			r.probe.pairSkills ? JSON.stringify(r.probe.pairSkills) : null,
			ts,
		);
	}

	return conflictId;
}

export function getRecentConflicts(db: Database, limit = 5): ConflictRow[] {
	return db
		.query<ConflictRow, [number]>(
			"SELECT * FROM skill_conflicts ORDER BY timestamp DESC LIMIT ?",
		)
		.all(limit);
}
