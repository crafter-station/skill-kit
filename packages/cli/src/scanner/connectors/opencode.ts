import type { Database } from "bun:sqlite";
import { Database as BunDatabase } from "bun:sqlite";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { Invocation } from "../index";
import { recordNewInvocations } from "../index";
import type { ScanCache } from "../scan-cache";

function getDbPath(): string | null {
	const os = platform();
	const candidates: string[] = [];

	if (os === "darwin") {
		candidates.push(
			join(
				process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"),
				"opencode",
			),
			join(homedir(), "Library", "Application Support", "opencode"),
		);
	} else if (os === "win32") {
		candidates.push(
			join(
				process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
				"opencode",
			),
		);
	} else {
		candidates.push(
			join(
				process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"),
				"opencode",
			),
		);
	}

	for (const dataDir of candidates) {
		const dbPath = join(dataDir, "opencode.db");
		if (existsSync(dbPath)) return dbPath;
	}
	return null;
}

function openDb(): InstanceType<typeof BunDatabase> | null {
	const dbPath = getDbPath();
	if (!dbPath) return null;
	try {
		return new BunDatabase(dbPath, { readonly: true });
	} catch {
		return null;
	}
}

interface PartRow {
	session_id: string;
	time_created: number;
	data: string;
}

export function countOpenCodeSessions(): number {
	const ocDb = openDb();
	if (!ocDb) return 0;

	try {
		const row = ocDb
			.query<{ count: number }, []>("SELECT COUNT(*) as count FROM session")
			.get();
		return row?.count ?? 0;
	} catch {
		return 0;
	} finally {
		ocDb.close();
	}
}

export function scanOpenCodeSessions(
	db: Database,
	trackedSet: Set<string>,
	cache?: ScanCache,
): number {
	const dbPath = getDbPath();
	if (dbPath && cache?.shouldSkip(dbPath)) return 0;
	const ocDb = openDb();
	if (!ocDb) return 0;

	try {
		const rows = ocDb
			.query<PartRow, []>(
				'SELECT p.session_id, p.time_created, p.data FROM part p WHERE p.data LIKE \'%"tool":"skill"%\'',
			)
			.all();

		const invocations: Invocation[] = [];

		for (const row of rows) {
			let data: Record<string, unknown>;
			try {
				data = JSON.parse(row.data);
			} catch {
				continue;
			}

			if (data.type !== "tool" || data.tool !== "skill") continue;

			const state = data.state as Record<string, unknown> | undefined;
			if (!state) continue;

			const input = state.input as Record<string, unknown> | undefined;
			if (!input) continue;

			const skillName =
				typeof input.name === "string"
					? input.name
					: typeof input.skill === "string"
						? input.skill
						: null;
			if (!skillName) continue;

			invocations.push({
				skillName,
				timestamp: new Date(row.time_created).toISOString(),
				sessionId: `oc:${row.session_id}`,
				agent: "opencode",
			});
		}

		return recordNewInvocations(db, trackedSet, invocations);
	} catch {
		return 0;
	} finally {
		ocDb.close();
	}
}
