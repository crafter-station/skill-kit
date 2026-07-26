import type { Database } from "bun:sqlite";
import { getDb } from "../db/schema";

export interface BaselineSource {
	name: string;
	type: string;
	tokens: number;
}

export interface BaselineSnapshot {
	name: string;
	createdAt: string;
	cwd: string;
	totalTokens: number;
	sources: BaselineSource[];
}

export interface SourceDelta {
	name: string;
	type: string;
	before: number;
	after: number;
	delta: number;
	kind: "added" | "removed" | "changed";
}

export interface BaselineDiff {
	baseline: BaselineSnapshot;
	totalBefore: number;
	totalAfter: number;
	totalDelta: number;
	pctDelta: number;
	changes: SourceDelta[];
}

export function ensureBaselineTable(db: Database): void {
	db.run(`
		CREATE TABLE IF NOT EXISTS context_baselines (
			name TEXT NOT NULL,
			cwd TEXT NOT NULL,
			created_at TEXT NOT NULL,
			total_tokens INTEGER NOT NULL,
			sources_json TEXT NOT NULL,
			PRIMARY KEY (name, cwd)
		)
	`);
}

export function saveBaseline(snapshot: BaselineSnapshot): void {
	const db = getDb();
	ensureBaselineTable(db);
	db.run(
		`INSERT INTO context_baselines (name, cwd, created_at, total_tokens, sources_json)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(name, cwd) DO UPDATE SET
		   created_at = excluded.created_at,
		   total_tokens = excluded.total_tokens,
		   sources_json = excluded.sources_json`,
		[
			snapshot.name,
			snapshot.cwd,
			snapshot.createdAt,
			snapshot.totalTokens,
			JSON.stringify(snapshot.sources),
		],
	);
	db.close();
}

interface BaselineRow {
	name: string;
	cwd: string;
	created_at: string;
	total_tokens: number;
	sources_json: string;
}

function rowToSnapshot(row: BaselineRow): BaselineSnapshot {
	let sources: BaselineSource[] = [];
	try {
		sources = JSON.parse(row.sources_json) as BaselineSource[];
	} catch {}
	return {
		name: row.name,
		cwd: row.cwd,
		createdAt: row.created_at,
		totalTokens: row.total_tokens,
		sources,
	};
}

export function loadBaseline(
	name: string,
	cwd: string,
): BaselineSnapshot | null {
	const db = getDb();
	ensureBaselineTable(db);
	const row = db
		.query("SELECT * FROM context_baselines WHERE name = ? AND cwd = ?")
		.get(name, cwd) as BaselineRow | null;
	db.close();
	return row ? rowToSnapshot(row) : null;
}

export function listBaselines(cwd?: string): BaselineSnapshot[] {
	const db = getDb();
	ensureBaselineTable(db);
	const rows = (
		cwd
			? db
					.query(
						"SELECT * FROM context_baselines WHERE cwd = ? ORDER BY created_at DESC",
					)
					.all(cwd)
			: db
					.query("SELECT * FROM context_baselines ORDER BY created_at DESC")
					.all()
	) as BaselineRow[];
	db.close();
	return rows.map(rowToSnapshot);
}

export function deleteBaseline(name: string, cwd: string): boolean {
	const db = getDb();
	ensureBaselineTable(db);
	const before =
		(
			db
				.query(
					"SELECT COUNT(*) as n FROM context_baselines WHERE name = ? AND cwd = ?",
				)
				.get(name, cwd) as { n: number } | null
		)?.n ?? 0;
	db.run("DELETE FROM context_baselines WHERE name = ? AND cwd = ?", [
		name,
		cwd,
	]);
	db.close();
	return before > 0;
}

/**
 * Diff a stored baseline against a fresh measurement.
 *
 * Sources are keyed by `type:name` so a file and a skill sharing a name never
 * collide, and so sources that appear or disappear between runs are surfaced
 * rather than silently folded into the total.
 */
export function diffBaseline(
	baseline: BaselineSnapshot,
	current: BaselineSource[],
): BaselineDiff {
	const key = (s: BaselineSource) => `${s.type}:${s.name}`;

	const beforeMap = new Map<string, BaselineSource>();
	for (const s of baseline.sources) beforeMap.set(key(s), s);

	const afterMap = new Map<string, BaselineSource>();
	for (const s of current) afterMap.set(key(s), s);

	const changes: SourceDelta[] = [];

	for (const [k, after] of afterMap) {
		const before = beforeMap.get(k);
		if (!before) {
			changes.push({
				name: after.name,
				type: after.type,
				before: 0,
				after: after.tokens,
				delta: after.tokens,
				kind: "added",
			});
		} else if (before.tokens !== after.tokens) {
			changes.push({
				name: after.name,
				type: after.type,
				before: before.tokens,
				after: after.tokens,
				delta: after.tokens - before.tokens,
				kind: "changed",
			});
		}
	}

	for (const [k, before] of beforeMap) {
		if (afterMap.has(k)) continue;
		changes.push({
			name: before.name,
			type: before.type,
			before: before.tokens,
			after: 0,
			delta: -before.tokens,
			kind: "removed",
		});
	}

	changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

	const totalAfter = current.reduce((sum, s) => sum + s.tokens, 0);
	const totalBefore = baseline.totalTokens;
	const totalDelta = totalAfter - totalBefore;

	return {
		baseline,
		totalBefore,
		totalAfter,
		totalDelta,
		pctDelta: totalBefore > 0 ? (totalDelta / totalBefore) * 100 : 0,
		changes,
	};
}

export function formatRelativeAge(iso: string, now: Date = new Date()): string {
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return "unknown";
	const diffMs = now.getTime() - then;
	const mins = Math.floor(diffMs / 60_000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
