import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const RECEIPT_OUTCOMES = [
	"unknown",
	"succeeded",
	"failed",
	"interrupted",
	"corrected",
	"inconclusive",
] as const;

export const CASE_SIGNALS = [
	"unreviewed",
	"routine",
	"candidate",
	"reviewed",
] as const;

export const CASE_REASONS = [
	"unknown",
	"routine",
	"failure",
	"correction",
	"interruption",
	"novel-transfer",
	"maintainer-feedback",
] as const;

export type ReceiptOutcome = (typeof RECEIPT_OUTCOMES)[number];
export type CaseSignal = (typeof CASE_SIGNALS)[number];
export type CaseReason = (typeof CASE_REASONS)[number];

export interface UsageReceipt {
	receipt_id: string;
	skill_name: string;
	agent: string;
	session_id: string | null;
	project: string | null;
	first_seen_at: string;
	last_seen_at: string;
	invocation_count: number;
	source_invocation_ids: string;
	procedure_path: string | null;
	procedure_digest: string | null;
	digest_status: "unknown" | "observed-after-session" | "exact";
	outcome: ReceiptOutcome;
	outcome_confidence: number | null;
	case_signal: CaseSignal;
	case_reason: CaseReason;
	summary: string | null;
	evidence_handles: string;
	visibility: "private";
	created_at: string;
	updated_at: string;
}

interface InvocationRow {
	id: number;
	skill_name: string;
	timestamp: string;
	session_id: string | null;
	project: string | null;
	agent: string | null;
	event_id: string | null;
}

export interface ReceiptAnnotation {
	receipt_id: string;
	outcome: ReceiptOutcome;
	outcome_confidence?: number | null;
	case_signal: CaseSignal;
	case_reason?: CaseReason;
	summary?: string | null;
	evidence_handles?: string[];
}

export function ensureUsageReceiptTable(db: Database): void {
	db.run(`
		CREATE TABLE IF NOT EXISTS usage_receipts (
			receipt_id TEXT PRIMARY KEY,
			skill_name TEXT NOT NULL,
			agent TEXT NOT NULL,
			session_id TEXT,
			project TEXT,
			first_seen_at TEXT NOT NULL,
			last_seen_at TEXT NOT NULL,
			invocation_count INTEGER NOT NULL,
			source_invocation_ids TEXT NOT NULL,
			procedure_path TEXT,
			procedure_digest TEXT,
			digest_status TEXT NOT NULL DEFAULT 'unknown',
			outcome TEXT NOT NULL DEFAULT 'unknown',
			outcome_confidence REAL,
			case_signal TEXT NOT NULL DEFAULT 'unreviewed',
			case_reason TEXT NOT NULL DEFAULT 'unknown',
			summary TEXT,
			evidence_handles TEXT NOT NULL DEFAULT '[]',
			visibility TEXT NOT NULL DEFAULT 'private',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)
	`);
	try {
		db.run(
			"ALTER TABLE usage_receipts ADD COLUMN case_reason TEXT NOT NULL DEFAULT 'unknown'",
		);
	} catch {}
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_receipts_skill ON usage_receipts(skill_name)",
	);
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_receipts_signal ON usage_receipts(case_signal)",
	);
	db.run(
		"CREATE INDEX IF NOT EXISTS idx_receipts_last_seen ON usage_receipts(last_seen_at DESC)",
	);
}

function hash(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function procedureForSkill(
	skillName: string,
	agent: string,
	roots: { cwd: string; home: string },
): Pick<UsageReceipt, "procedure_path" | "procedure_digest" | "digest_status"> {
	const candidates = [
		join(roots.cwd, ".agents", "skills", skillName, "SKILL.md"),
		join(roots.home, ".agents", "skills", skillName, "SKILL.md"),
	];
	const agentRoots: Record<string, string[]> = {
		claude: [".claude"],
		codex: [".codex"],
		cursor: [".cursor"],
		gemini: [".gemini"],
		opencode: [
			join(".config", "opencode"),
			join(".local", "share", "opencode"),
		],
	};
	for (const root of agentRoots[agent] ?? []) {
		candidates.push(join(roots.cwd, root, "skills", skillName, "SKILL.md"));
		candidates.push(join(roots.home, root, "skills", skillName, "SKILL.md"));
	}
	const observed: Array<{ path: string; digest: string }> = [];
	for (const path of candidates) {
		if (!existsSync(path)) continue;
		try {
			observed.push({
				path,
				digest: `sha256:${hash(readFileSync(path, "utf-8"))}`,
			});
		} catch {}
	}
	if (
		observed.length === 0 ||
		new Set(observed.map((item) => item.digest)).size > 1
	) {
		return {
			procedure_path: null,
			procedure_digest: null,
			digest_status: "unknown",
		};
	}
	return {
		procedure_path: observed[0]?.path ?? null,
		procedure_digest: observed[0]?.digest ?? null,
		digest_status: "observed-after-session",
	};
}

function receiptKey(row: InvocationRow): string {
	const session = row.session_id ?? row.event_id ?? `invocation:${row.id}`;
	return `${row.agent ?? "unknown"}\u0000${session}\u0000${row.skill_name}`;
}

export function syncUsageReceipts(
	db: Database,
	options: { cwd?: string; home?: string } = {},
): number {
	ensureUsageReceiptTable(db);
	let invocations: InvocationRow[];
	try {
		invocations = db
			.query<InvocationRow, []>(
				`SELECT id, skill_name, timestamp, session_id, project, agent, event_id
				FROM skill_invocations
				ORDER BY timestamp ASC, id ASC`,
			)
			.all();
	} catch {
		invocations = db
			.query<InvocationRow, []>(
				`SELECT id, skill_name, timestamp, session_id, project, agent, NULL AS event_id
				FROM skill_invocations
				ORDER BY timestamp ASC, id ASC`,
			)
			.all();
	}
	const groups = new Map<string, InvocationRow[]>();
	for (const invocation of invocations) {
		const key = receiptKey(invocation);
		const group = groups.get(key) ?? [];
		group.push(invocation);
		groups.set(key, group);
	}

	const now = new Date().toISOString();
	const existing = new Set(
		db
			.query<{ receipt_id: string }, []>(
				"SELECT receipt_id FROM usage_receipts",
			)
			.all()
			.map((row) => row.receipt_id),
	);
	let created = 0;
	const upsert = db.query(
		`INSERT INTO usage_receipts (
			receipt_id, skill_name, agent, session_id, project,
			first_seen_at, last_seen_at, invocation_count, source_invocation_ids,
			procedure_path, procedure_digest, digest_status, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(receipt_id) DO UPDATE SET
			first_seen_at = excluded.first_seen_at,
			last_seen_at = excluded.last_seen_at,
			invocation_count = excluded.invocation_count,
			source_invocation_ids = excluded.source_invocation_ids,
			project = COALESCE(usage_receipts.project, excluded.project),
			procedure_path = COALESCE(usage_receipts.procedure_path, excluded.procedure_path),
			procedure_digest = COALESCE(usage_receipts.procedure_digest, excluded.procedure_digest),
			digest_status = CASE
				WHEN usage_receipts.digest_status = 'unknown' THEN excluded.digest_status
				ELSE usage_receipts.digest_status
			END,
			updated_at = excluded.updated_at`,
	);

	const transaction = db.transaction(() => {
		for (const rows of groups.values()) {
			const first = rows[0];
			const last = rows[rows.length - 1];
			if (!first || !last) continue;
			const agent = first.agent ?? "unknown";
			const session =
				first.session_id ?? first.event_id ?? `invocation:${first.id}`;
			const receiptId = `ur_${hash(`${agent}\u0000${session}\u0000${first.skill_name}`).slice(0, 24)}`;
			const procedure = procedureForSkill(first.skill_name, agent, {
				cwd: options.cwd ?? process.cwd(),
				home: options.home ?? homedir(),
			});
			const sourceIds = rows.map((row) =>
				row.event_id ? `event:${row.event_id}` : `invocation:${row.id}`,
			);
			upsert.run(
				receiptId,
				first.skill_name,
				agent,
				first.session_id,
				rows.find((row) => row.project)?.project ?? null,
				first.timestamp,
				last.timestamp,
				rows.length,
				JSON.stringify(sourceIds),
				procedure.procedure_path,
				procedure.procedure_digest,
				procedure.digest_status,
				now,
				now,
			);
			if (!existing.has(receiptId)) created++;
		}
	});
	transaction();
	return created;
}

export function getUsageReceipts(
	db: Database,
	options: { pending?: boolean; limit?: number; after?: string } = {},
): UsageReceipt[] {
	return [...iterateUsageReceipts(db, options)];
}

export function getUsageReceiptPage(
	db: Database,
	options: { pending?: boolean; limit: number; after?: string },
): { receipts: UsageReceipt[]; nextCursor: string | null } {
	const page = [
		...iterateUsageReceipts(db, {
			...options,
			limit: options.limit + 1,
		}),
	];
	const hasMore = page.length > options.limit;
	const receipts = page.slice(0, options.limit);
	return {
		receipts,
		nextCursor: hasMore
			? (receipts[receipts.length - 1]?.receipt_id ?? null)
			: null,
	};
}

export function* iterateUsageReceipts(
	db: Database,
	options: {
		pending?: boolean;
		limit?: number;
		after?: string;
		all?: boolean;
	} = {},
): Generator<UsageReceipt> {
	ensureUsageReceiptTable(db);
	let remaining = options.all
		? Number.POSITIVE_INFINITY
		: Math.max(1, Math.floor(options.limit ?? 100));
	let cursorTime: string | null = null;
	let cursorId: string | null = null;
	if (options.after) {
		const cursor = db
			.query<{ receipt_id: string; last_seen_at: string }, [string]>(
				"SELECT receipt_id, last_seen_at FROM usage_receipts WHERE receipt_id = ?",
			)
			.get(options.after);
		if (!cursor) throw new Error(`Unknown receipt cursor: ${options.after}`);
		cursorTime = cursor.last_seen_at;
		cursorId = cursor.receipt_id;
	}
	while (remaining > 0) {
		const pageSize = Math.min(500, remaining);
		const clauses = [];
		const params: Array<string | number> = [];
		if (options.pending) clauses.push("case_signal = 'unreviewed'");
		if (cursorTime && cursorId) {
			clauses.push(
				"(last_seen_at < ? OR (last_seen_at = ? AND receipt_id < ?))",
			);
			params.push(cursorTime, cursorTime, cursorId);
		}
		const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
		params.push(pageSize);
		const page = db
			.query<UsageReceipt, Array<string | number>>(
				`SELECT * FROM usage_receipts ${where}
				ORDER BY last_seen_at DESC, receipt_id DESC LIMIT ?`,
			)
			.all(...params);
		if (page.length === 0) return;
		for (const receipt of page) yield receipt;
		remaining -= page.length;
		if (page.length < pageSize) return;
		const last = page[page.length - 1];
		if (!last) return;
		cursorTime = last.last_seen_at;
		cursorId = last.receipt_id;
	}
}

export function annotateUsageReceipt(
	db: Database,
	annotation: ReceiptAnnotation,
): void {
	if (!RECEIPT_OUTCOMES.includes(annotation.outcome)) {
		throw new Error(`Invalid outcome: ${annotation.outcome}`);
	}
	if (!CASE_SIGNALS.includes(annotation.case_signal)) {
		throw new Error(`Invalid case signal: ${annotation.case_signal}`);
	}
	if (
		annotation.case_reason !== undefined &&
		!CASE_REASONS.includes(annotation.case_reason)
	) {
		throw new Error(`Invalid case reason: ${annotation.case_reason}`);
	}
	const reason = annotation.case_reason ?? "unknown";
	const expectedOutcomes: Partial<Record<CaseReason, ReceiptOutcome>> = {
		routine: "succeeded",
		failure: "failed",
		correction: "corrected",
		interruption: "interrupted",
	};
	if (
		expectedOutcomes[reason] &&
		expectedOutcomes[reason] !== annotation.outcome
	) {
		throw new Error(
			`${reason} reason requires ${expectedOutcomes[reason]} outcome`,
		);
	}
	if (annotation.outcome === "unknown") {
		if (
			annotation.case_signal !== "unreviewed" ||
			reason !== "unknown" ||
			(annotation.outcome_confidence !== undefined &&
				annotation.outcome_confidence !== null)
		) {
			throw new Error(
				"unknown outcome must remain unreviewed with unknown reason and no confidence",
			);
		}
	} else if (
		annotation.outcome_confidence === undefined ||
		annotation.outcome_confidence === null
	) {
		throw new Error("reviewed outcomes require outcome_confidence");
	}
	if (
		["candidate", "reviewed"].includes(annotation.case_signal) &&
		(!annotation.case_reason ||
			["unknown", "routine"].includes(annotation.case_reason))
	) {
		throw new Error(
			"candidate and reviewed signals require a high-signal reason",
		);
	}
	if (
		annotation.case_signal === "routine" &&
		annotation.case_reason !== "routine"
	) {
		throw new Error("routine signal requires routine reason");
	}
	const requiresCaseEvidence =
		["candidate", "reviewed"].includes(annotation.case_signal) ||
		["failed", "interrupted", "corrected"].includes(annotation.outcome) ||
		!["unknown", "routine"].includes(reason);
	if (requiresCaseEvidence) {
		if (!annotation.summary?.trim()) {
			throw new Error("case candidates require a summary");
		}
		if (
			!annotation.evidence_handles ||
			annotation.evidence_handles.length === 0 ||
			annotation.evidence_handles.some((handle) => !handle.trim()) ||
			new Set(annotation.evidence_handles).size !==
				annotation.evidence_handles.length
		) {
			throw new Error("case candidates require unique evidence handles");
		}
	}
	if (
		annotation.outcome_confidence !== undefined &&
		annotation.outcome_confidence !== null &&
		(!Number.isFinite(annotation.outcome_confidence) ||
			annotation.outcome_confidence < 0 ||
			annotation.outcome_confidence > 1)
	) {
		throw new Error("outcome_confidence must be between 0 and 1");
	}
	ensureUsageReceiptTable(db);
	const result = db.run(
		`UPDATE usage_receipts SET
			outcome = ?, outcome_confidence = ?, case_signal = ?, case_reason = ?, summary = ?,
			evidence_handles = ?, updated_at = ?
		WHERE receipt_id = ?`,
		[
			annotation.outcome,
			annotation.outcome_confidence ?? null,
			annotation.case_signal,
			annotation.case_reason ?? "unknown",
			annotation.summary ?? null,
			JSON.stringify(annotation.evidence_handles ?? []),
			new Date().toISOString(),
			annotation.receipt_id,
		],
	);
	if (result.changes === 0) {
		throw new Error(`Unknown receipt: ${annotation.receipt_id}`);
	}
}

export function annotateUsageReceipts(
	db: Database,
	annotations: ReceiptAnnotation[],
): void {
	const transaction = db.transaction(() => {
		for (const annotation of annotations) {
			annotateUsageReceipt(db, annotation);
		}
	});
	transaction();
}
