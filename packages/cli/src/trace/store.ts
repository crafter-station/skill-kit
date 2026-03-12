import type { Database } from "bun:sqlite";
import type { TraceResult } from "./engine";

export interface TraceRow {
	id: number;
	trace_id: string;
	skill_name: string | null;
	prompt: string;
	response: string | null;
	tool_calls: string;
	files_read: string | null;
	tokens_in: number;
	tokens_out: number;
	tokens_total: number;
	cache_creation_tokens: number;
	cache_read_tokens: number;
	duration_ms: number;
	cost_estimate: number;
	model: string;
	timestamp: string;
	project: string | null;
}

export function ensureTraceTable(db: Database): void {
	db.run(`
		CREATE TABLE IF NOT EXISTS skill_traces (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			trace_id TEXT UNIQUE NOT NULL,
			skill_name TEXT,
			prompt TEXT NOT NULL,
			tool_calls TEXT NOT NULL,
			files_read TEXT,
			tokens_in INTEGER DEFAULT 0,
			tokens_out INTEGER DEFAULT 0,
			tokens_total INTEGER DEFAULT 0,
			cache_creation_tokens INTEGER DEFAULT 0,
			cache_read_tokens INTEGER DEFAULT 0,
			duration_ms INTEGER DEFAULT 0,
			cost_estimate REAL DEFAULT 0,
			model TEXT,
			timestamp TEXT NOT NULL,
			project TEXT
		)
	`);
	db.run("CREATE INDEX IF NOT EXISTS idx_traces_skill ON skill_traces(skill_name)");
	db.run("CREATE INDEX IF NOT EXISTS idx_traces_ts ON skill_traces(timestamp DESC)");

	const cols = db.query<{ name: string }, []>("PRAGMA table_info(skill_traces)").all();
	const colNames = new Set(cols.map((c) => c.name));
	if (!colNames.has("cache_creation_tokens")) {
		db.run("ALTER TABLE skill_traces ADD COLUMN cache_creation_tokens INTEGER DEFAULT 0");
	}
	if (!colNames.has("cache_read_tokens")) {
		db.run("ALTER TABLE skill_traces ADD COLUMN cache_read_tokens INTEGER DEFAULT 0");
	}
	if (!colNames.has("response")) {
		db.run("ALTER TABLE skill_traces ADD COLUMN response TEXT");
	}
}

export function saveTrace(db: Database, trace: TraceResult, project?: string): void {
	db.run(
		`INSERT INTO skill_traces (trace_id, skill_name, prompt, response, tool_calls, files_read, tokens_in, tokens_out, tokens_total, cache_creation_tokens, cache_read_tokens, duration_ms, cost_estimate, model, timestamp, project)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			trace.traceId,
			trace.skillName,
			trace.prompt,
			trace.response,
			JSON.stringify(trace.toolCalls),
			JSON.stringify(trace.filesRead),
			trace.tokensIn,
			trace.tokensOut,
			trace.tokensTotal,
			trace.cacheCreationTokens,
			trace.cacheReadTokens,
			trace.durationMs,
			trace.costEstimate,
			trace.model,
			trace.timestamp,
			project ?? null,
		],
	);
}

export function getTrace(db: Database, traceId: string): TraceRow | null {
	return (
		db
			.query<TraceRow, [string]>("SELECT * FROM skill_traces WHERE trace_id = ?")
			.get(traceId) ?? null
	);
}

export function getRecentTraces(db: Database, limit = 10): TraceRow[] {
	return db
		.query<TraceRow, [number]>(
			"SELECT * FROM skill_traces ORDER BY timestamp DESC LIMIT ?",
		)
		.all(limit);
}

export function getTracesBySkill(
	db: Database,
	skillName: string,
	limit = 20,
): TraceRow[] {
	return db
		.query<TraceRow, [string, number]>(
			"SELECT * FROM skill_traces WHERE skill_name = ? ORDER BY timestamp DESC LIMIT ?",
		)
		.all(skillName, limit);
}
