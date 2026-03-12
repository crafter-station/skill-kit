import type { Database } from "bun:sqlite";
import type { BenchmarkStats } from "./benchmark";

export interface BenchmarkRow {
	id: number;
	benchmark_id: string;
	skill_name: string;
	skill_version: string | null;
	eval_id: number;
	eval_name: string | null;
	config: string;
	run_number: number;
	pass_rate: number;
	passed: number;
	failed: number;
	total: number;
	tokens: number;
	time_seconds: number;
	timestamp: string;
}

export function ensureBenchmarkTable(db: Database): void {
	db.run(`
		CREATE TABLE IF NOT EXISTS skill_benchmarks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			benchmark_id TEXT NOT NULL,
			skill_name TEXT NOT NULL,
			skill_version TEXT,
			eval_id INTEGER,
			eval_name TEXT,
			config TEXT NOT NULL,
			run_number INTEGER DEFAULT 0,
			pass_rate REAL DEFAULT 0,
			passed INTEGER DEFAULT 0,
			failed INTEGER DEFAULT 0,
			total INTEGER DEFAULT 0,
			tokens INTEGER DEFAULT 0,
			time_seconds REAL DEFAULT 0,
			timestamp TEXT NOT NULL
		)
	`);
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_bench_skill ON skill_benchmarks(skill_name)",
	);
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_bench_ts ON skill_benchmarks(timestamp DESC)",
	);
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_bench_id ON skill_benchmarks(benchmark_id)",
	);
}

export function saveBenchmark(
	db: Database,
	stats: BenchmarkStats,
	skillVersion?: string,
): void {
	const ts = new Date().toISOString();
	const stmt = db.prepare(
		`INSERT INTO skill_benchmarks (benchmark_id, skill_name, skill_version, eval_id, eval_name, config, run_number, pass_rate, passed, failed, total, tokens, time_seconds, timestamp)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	);

	for (let i = 0; i < stats.perEval.length; i++) {
		const e = stats.perEval[i]!;
		const passed = Math.round(e.passRate * 1);
		const total = 1;
		stmt.run(
			stats.benchmarkId,
			stats.skillName,
			skillVersion ?? null,
			e.evalId,
			e.prompt.slice(0, 100),
			stats.config,
			i + 1,
			e.passRate,
			passed,
			total - passed,
			total,
			e.tokens,
			e.timeSeconds,
			ts,
		);
	}
}

export function getRecentBenchmarks(
	db: Database,
	skillName: string,
	limit = 5,
): BenchmarkRow[] {
	return db
		.query<BenchmarkRow, [string, number]>(
			`SELECT * FROM skill_benchmarks WHERE skill_name = ? ORDER BY timestamp DESC LIMIT ?`,
		)
		.all(skillName, limit);
}

export function getBenchmarkById(
	db: Database,
	benchmarkId: string,
): BenchmarkRow[] {
	return db
		.query<BenchmarkRow, [string]>(
			"SELECT * FROM skill_benchmarks WHERE benchmark_id = ? ORDER BY run_number",
		)
		.all(benchmarkId);
}
