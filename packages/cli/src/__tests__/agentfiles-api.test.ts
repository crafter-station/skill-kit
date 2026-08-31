import { describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	AGENTFILES_SNAPSHOT_TEMP_PREFIX,
	clearAgentfilesSnapshot,
	clearAgentfilesSnapshotTemps,
	parseAgentfilesSnapshot,
} from "../agentfiles/api.js";

describe("Agentfiles API", () => {
	test("parses a versioned snapshot", () => {
		const snapshot = parseAgentfilesSnapshot(
			JSON.stringify({
				version: 1,
				generatedAt: "2026-08-31T00:00:00.000Z",
				dashboard: { stats: null, health: null, burn: null, context: null },
				skills: {},
			}),
		);
		expect(snapshot?.version).toBe(1);
	});

	test("rejects malformed and unsupported snapshots", () => {
		expect(parseAgentfilesSnapshot("not-json")).toBeNull();
		expect(parseAgentfilesSnapshot(JSON.stringify({ version: 2 }))).toBeNull();
		expect(
			parseAgentfilesSnapshot(
				JSON.stringify({
					version: 1,
					generatedAt: "2026-08-31T00:00:00.000Z",
					dashboard: { stats: null, health: null, burn: null, context: null },
					skills: { broken: {} },
				}),
			),
		).toBeNull();
	});

	test("clears the snapshot and every temporary sibling", () => {
		const directory = mkdtempSync(join(tmpdir(), "skillkit-agentfiles-api-"));
		try {
			const snapshotPath = join(directory, "agentfiles-snapshot.json");
			mkdirSync(directory, { recursive: true });
			writeFileSync(snapshotPath, "{}");
			writeFileSync(
				join(directory, `${AGENTFILES_SNAPSHOT_TEMP_PREFIX}one.tmp`),
				"one",
			);
			writeFileSync(
				join(directory, `${AGENTFILES_SNAPSHOT_TEMP_PREFIX}two.tmp`),
				"two",
			);
			const old = new Date(Date.now() - 172_800_000);
			utimesSync(
				join(directory, `${AGENTFILES_SNAPSHOT_TEMP_PREFIX}one.tmp`),
				old,
				old,
			);
			utimesSync(
				join(directory, `${AGENTFILES_SNAPSHOT_TEMP_PREFIX}two.tmp`),
				old,
				old,
			);
			clearAgentfilesSnapshot(snapshotPath);
			expect(readdirSync(directory)).toEqual([]);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	test("stale cleanup preserves another active writer", () => {
		const directory = mkdtempSync(join(tmpdir(), "skillkit-agentfiles-api-"));
		try {
			const snapshotPath = join(directory, "agentfiles-snapshot.json");
			const active = join(
				directory,
				`${AGENTFILES_SNAPSHOT_TEMP_PREFIX}active.tmp`,
			);
			const stale = join(
				directory,
				`${AGENTFILES_SNAPSHOT_TEMP_PREFIX}stale.tmp`,
			);
			writeFileSync(active, "active");
			writeFileSync(stale, "stale");
			const old = new Date(Date.now() - 172_800_000);
			utimesSync(stale, old, old);
			clearAgentfilesSnapshotTemps(snapshotPath, 86_400_000);
			expect(readdirSync(directory)).toEqual([
				`${AGENTFILES_SNAPSHOT_TEMP_PREFIX}active.tmp`,
			]);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
});
