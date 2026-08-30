import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	annotateUsageReceipt,
	annotateUsageReceipts,
	ensureUsageReceiptTable,
	getUsageReceiptPage,
	getUsageReceipts,
	syncUsageReceipts,
} from "../receipts/store";

function makeDb(): Database {
	const db = new Database(":memory:");
	db.run(`CREATE TABLE skill_invocations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		skill_name TEXT NOT NULL,
		timestamp TEXT NOT NULL,
		session_id TEXT,
		project TEXT,
		success INTEGER DEFAULT 1,
		agent TEXT,
		event_id TEXT
	)`);
	db.run(`CREATE TABLE installed_skills (
		name TEXT PRIMARY KEY,
		path TEXT NOT NULL,
		installed_at TEXT NOT NULL,
		source TEXT,
		version TEXT,
		size_bytes INTEGER
	)`);
	ensureUsageReceiptTable(db);
	return db;
}

describe("usage receipts", () => {
	it("groups invocations by agent, session, and skill", () => {
		const db = makeDb();
		db.run(
			"INSERT INTO skill_invocations (skill_name, timestamp, session_id, agent, event_id) VALUES (?, ?, ?, ?, ?)",
			["review-gate", "2026-08-29T10:00:00Z", "s1", "codex", "e1"],
		);
		db.run(
			"INSERT INTO skill_invocations (skill_name, timestamp, session_id, agent, event_id) VALUES (?, ?, ?, ?, ?)",
			["review-gate", "2026-08-29T10:05:00Z", "s1", "codex", "e2"],
		);

		expect(syncUsageReceipts(db)).toBe(1);
		const receipts = getUsageReceipts(db);
		expect(receipts).toHaveLength(1);
		expect(receipts[0]?.invocation_count).toBe(2);
		expect(receipts[0]?.outcome).toBe("unknown");
		expect(receipts[0]?.visibility).toBe("private");
	});

	it("separates agent, session, skill, and sessionless invocation identities", () => {
		const db = makeDb();
		const rows = [
			["shaping", "2026-08-29T10:00:00Z", "s1", "codex", "e1"],
			["shaping", "2026-08-29T10:01:00Z", "s1", "claude", "e2"],
			["shaping", "2026-08-29T10:02:00Z", "s2", "codex", "e3"],
			["review-gate", "2026-08-29T10:03:00Z", "s1", "codex", "e4"],
			["shaping", "2026-08-29T10:04:00Z", null, "codex", "e5"],
			["shaping", "2026-08-29T10:05:00Z", null, "codex", "e6"],
		] as const;
		for (const row of rows) {
			db.run(
				"INSERT INTO skill_invocations (skill_name, timestamp, session_id, agent, event_id) VALUES (?, ?, ?, ?, ?)",
				[...row],
			);
		}

		expect(syncUsageReceipts(db)).toBe(6);
		expect(getUsageReceipts(db)).toHaveLength(6);
	});

	it("backfills idempotently and preserves annotations", () => {
		const db = makeDb();
		db.run(
			"INSERT INTO skill_invocations (skill_name, timestamp, session_id, agent) VALUES (?, ?, ?, ?)",
			["shaping", "2026-08-29T10:00:00Z", "s1", "claude"],
		);
		expect(syncUsageReceipts(db)).toBe(1);
		const receipt = getUsageReceipts(db)[0];
		if (!receipt) throw new Error("Expected receipt");
		annotateUsageReceipt(db, {
			receipt_id: receipt.receipt_id,
			outcome: "corrected",
			outcome_confidence: 0.9,
			case_signal: "candidate",
			case_reason: "correction",
			summary: "The first boundary was too broad.",
			evidence_handles: ["session:s1"],
		});

		expect(syncUsageReceipts(db)).toBe(0);
		const updated = getUsageReceipts(db)[0];
		expect(updated?.outcome).toBe("corrected");
		expect(updated?.case_signal).toBe("candidate");
		expect(updated?.case_reason).toBe("correction");
		expect(updated?.summary).toBe("The first boundary was too broad.");
	});

	it("paginates deterministically by receipt cursor", () => {
		const db = makeDb();
		for (let index = 0; index < 3; index++) {
			db.run(
				"INSERT INTO skill_invocations (skill_name, timestamp, session_id, agent) VALUES (?, ?, ?, ?)",
				["shaping", `2026-08-29T10:0${index}:00Z`, `s${index}`, "codex"],
			);
		}
		syncUsageReceipts(db);
		const firstPage = getUsageReceipts(db, { limit: 2 });
		const secondPage = getUsageReceipts(db, {
			limit: 2,
			after: firstPage[1]?.receipt_id,
		});
		expect(firstPage).toHaveLength(2);
		expect(secondPage).toHaveLength(1);
		expect(secondPage[0]?.receipt_id).not.toBe(firstPage[0]?.receipt_id);
	});

	it("emits a cursor only when another receipt exists", () => {
		const db = makeDb();
		for (let index = 0; index < 3; index++) {
			db.run(
				"INSERT INTO skill_invocations (skill_name, timestamp, session_id, agent) VALUES (?, ?, ?, ?)",
				["shaping", `2026-08-29T10:0${index}:00Z`, `s${index}`, "codex"],
			);
		}
		syncUsageReceipts(db);

		const first = getUsageReceiptPage(db, { limit: 2 });
		const last = getUsageReceiptPage(db, {
			limit: 2,
			after: first.nextCursor ?? undefined,
		});

		expect(first.receipts).toHaveLength(2);
		expect(first.nextCursor).not.toBeNull();
		expect(last.receipts).toHaveLength(1);
		expect(last.nextCursor).toBeNull();
	});

	it("rolls back a batch when one annotation is invalid", () => {
		const db = makeDb();
		db.run(
			"INSERT INTO skill_invocations (skill_name, timestamp, session_id, agent) VALUES (?, ?, ?, ?)",
			["shaping", "2026-08-29T10:00:00Z", "s1", "codex"],
		);
		syncUsageReceipts(db);
		const receipt = getUsageReceipts(db)[0];
		if (!receipt) throw new Error("Expected receipt");
		expect(() =>
			annotateUsageReceipts(db, [
				{
					receipt_id: receipt.receipt_id,
					outcome: "succeeded",
					outcome_confidence: 1,
					case_signal: "routine",
					case_reason: "routine",
				},
				{
					receipt_id: "ur_missing",
					outcome: "succeeded",
					outcome_confidence: 1,
					case_signal: "routine",
					case_reason: "routine",
				},
			]),
		).toThrow("Unknown receipt: ur_missing");
		expect(getUsageReceipts(db)[0]?.outcome).toBe("unknown");
	});

	it("backfills a database without event_id", () => {
		const db = new Database(":memory:");
		db.run(`CREATE TABLE skill_invocations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			skill_name TEXT NOT NULL,
			timestamp TEXT NOT NULL,
			session_id TEXT,
			project TEXT,
			agent TEXT
		)`);
		db.run(
			"INSERT INTO skill_invocations (skill_name, timestamp, session_id, agent) VALUES (?, ?, ?, ?)",
			["shaping", "2026-08-29T10:00:00Z", "s1", "codex"],
		);
		expect(syncUsageReceipts(db)).toBe(1);
		expect(getUsageReceipts(db)).toHaveLength(1);
	});

	it("records an observed procedure digest without claiming exact history", () => {
		const db = makeDb();
		const root = mkdtempSync(join(tmpdir(), "skillkit-receipt-"));
		const skillPath = join(root, ".agents", "skills", "shaping");
		mkdirSync(skillPath, { recursive: true });
		writeFileSync(join(skillPath, "SKILL.md"), "# Shaping\n");
		db.run(
			"INSERT INTO skill_invocations (skill_name, timestamp, session_id, agent) VALUES (?, ?, ?, ?)",
			["shaping", "2026-08-29T10:00:00Z", "s1", "codex"],
		);

		syncUsageReceipts(db, { cwd: root, home: join(root, "home") });
		const receipt = getUsageReceipts(db)[0];
		expect(receipt?.procedure_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
		expect(receipt?.digest_status).toBe("observed-after-session");
	});

	it("keeps agent-specific procedure digests separate", () => {
		const db = makeDb();
		const root = mkdtempSync(join(tmpdir(), "skillkit-agent-receipt-"));
		const claude = join(root, ".claude", "skills", "shaping");
		const codex = join(root, ".codex", "skills", "shaping");
		mkdirSync(claude, { recursive: true });
		mkdirSync(codex, { recursive: true });
		writeFileSync(join(claude, "SKILL.md"), "# Claude shaping\n");
		writeFileSync(join(codex, "SKILL.md"), "# Codex shaping\n");
		db.run(
			"INSERT INTO skill_invocations (skill_name, timestamp, session_id, agent) VALUES (?, ?, ?, ?)",
			["shaping", "2026-08-29T10:00:00Z", "c1", "claude"],
		);
		db.run(
			"INSERT INTO skill_invocations (skill_name, timestamp, session_id, agent) VALUES (?, ?, ?, ?)",
			["shaping", "2026-08-29T10:01:00Z", "c2", "codex"],
		);

		syncUsageReceipts(db, { cwd: root, home: join(root, "home") });
		const receipts = getUsageReceipts(db);
		const claudeReceipt = receipts.find(
			(receipt) => receipt.agent === "claude",
		);
		const codexReceipt = receipts.find((receipt) => receipt.agent === "codex");
		expect(claudeReceipt?.procedure_digest).not.toBe(
			codexReceipt?.procedure_digest,
		);
		expect(claudeReceipt?.procedure_path).toContain(".claude/skills/shaping");
		expect(codexReceipt?.procedure_path).toContain(".codex/skills/shaping");
	});

	it("rejects invalid annotations", () => {
		const db = makeDb();
		db.run(
			"INSERT INTO skill_invocations (skill_name, timestamp, session_id, agent) VALUES (?, ?, ?, ?)",
			["shaping", "2026-08-29T10:00:00Z", "s1", "codex"],
		);
		syncUsageReceipts(db);
		const receipt = getUsageReceipts(db)[0];
		if (!receipt) throw new Error("Expected receipt");
		expect(() =>
			annotateUsageReceipt(db, {
				receipt_id: receipt.receipt_id,
				outcome: "succeeded",
				outcome_confidence: 1.1,
				case_signal: "routine",
				case_reason: "routine",
			}),
		).toThrow("outcome_confidence must be between 0 and 1");
		expect(() =>
			annotateUsageReceipt(db, {
				receipt_id: receipt.receipt_id,
				outcome: "succeeded",
				case_signal: "candidate",
				case_reason: "unsupported" as "correction",
			}),
		).toThrow("Invalid case reason: unsupported");
		expect(() =>
			annotateUsageReceipt(db, {
				receipt_id: receipt.receipt_id,
				outcome: "succeeded",
				outcome_confidence: 1,
				case_signal: "candidate",
				case_reason: "failure",
				summary: "Contradictory",
				evidence_handles: ["session:s1"],
			}),
		).toThrow("failure reason requires failed outcome");
		expect(() =>
			annotateUsageReceipt(db, {
				receipt_id: receipt.receipt_id,
				outcome: "failed",
				outcome_confidence: 1,
				case_signal: "reviewed",
				case_reason: "failure",
				summary: "Missing evidence",
			}),
		).toThrow("require unique evidence handles");
		expect(() =>
			annotateUsageReceipt(db, {
				receipt_id: receipt.receipt_id,
				outcome: "failed",
				outcome_confidence: 1,
				case_signal: "unreviewed",
				case_reason: "failure",
			}),
		).toThrow("case candidates require a summary");
	});
});
