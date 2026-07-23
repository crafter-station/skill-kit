import type { Database } from "bun:sqlite";
import { Database as BunDatabase } from "bun:sqlite";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProgressReporter } from "../../tui/progress";
import type { Invocation } from "../index";
import { recordNewInvocations } from "../index";
import type { ScanCache } from "../scan-cache";
import {
	countClineFamilyTasks,
	parseClineFamilyApiHistory,
	parseClineFamilyUiMessages,
	scanClineFamilyTasks,
	vscodeGlobalStorageBases,
} from "./cline-family";

// Kilo Code (github.com/Kilo-Org/kilocode, publisher kilocode, name kilo-code).
// Two storage generations, both verified in source:
//
// 1. LEGACY (Cline-family task dirs) - pre opencode-engine versions:
//      packages/kilo-vscode/src/legacy-migration/task-store.ts
//      (API_FILE = "api_conversation_history.json", UI_FILE = "ui_messages.json")
//    macOS: ~/Library/Application Support/<IDE>/User/globalStorage/kilocode.kilo-code/tasks/<taskId>/
//    (kilo's own path table: packages/opencode/src/kilocode/paths.ts vscodeGlobalStorage())
//
// 2. CURRENT (opencode-engine sqlite) - the VS Code extension spawns the Kilo
//    CLI backend, so all new sessions land in one sqlite database:
//      packages/core/src/global.ts        app = "kilo", data = xdgData/kilo
//      packages/core/src/database/database.ts:54  join(Global.Path.data, "kilo.db")
//      packages/core/src/session/sql.ts   part table: session_id, time_created, data JSON
//      packages/opencode/src/tool/skill.ts  native "skill" tool, params { name }
//    Path (all platforms via xdg-basedir): ~/.local/share/kilo/kilo.db
//    (respects XDG_DATA_HOME).

const KILO_EXTENSION_ID = "kilocode.kilo-code";

function kiloLegacyStorageBases(): string[] {
	return vscodeGlobalStorageBases(KILO_EXTENSION_ID);
}

function kiloDbPath(): string | null {
	const dataHome =
		process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
	const dbPath = join(dataHome, "kilo", "kilo.db");
	return existsSync(dbPath) ? dbPath : null;
}

function openKiloDb(): InstanceType<typeof BunDatabase> | null {
	const dbPath = kiloDbPath();
	if (!dbPath) return null;
	try {
		return new BunDatabase(dbPath, { readonly: true });
	} catch {
		return null;
	}
}

export function parseKiloTaskFile(
	filePath: string,
	taskId: string,
	knownSkills: Set<string> = new Set(),
	fallbackTimestamp: string = new Date().toISOString(),
): Invocation[] {
	const sessionId = `kilo:${taskId}`;
	if (filePath.endsWith("api_conversation_history.json")) {
		return parseClineFamilyApiHistory(
			filePath,
			"kilocode",
			sessionId,
			knownSkills,
			fallbackTimestamp,
		);
	}
	return parseClineFamilyUiMessages(
		filePath,
		"kilocode",
		sessionId,
		knownSkills,
		fallbackTimestamp,
	);
}

interface KiloPartRow {
	session_id: string;
	time_created: number;
	data: string;
}

/**
 * Extract skill invocations from a kilo.db `part` row's JSON payload.
 * Shape (packages/core/src/v1/session.ts ToolPart):
 *   { type: "tool", tool: "skill", callID, state: { status, input: { name }, ... } }
 */
export function parseKiloPartData(
	sessionId: string,
	timeCreated: number,
	raw: string,
	knownSkills: Set<string> = new Set(),
): Invocation[] {
	let data: Record<string, unknown>;
	try {
		data = JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return [];
	}
	if (typeof data !== "object" || data === null) return [];
	if (data.type !== "tool" || data.tool !== "skill") return [];

	const state = data.state as Record<string, unknown> | undefined;
	if (!state || typeof state !== "object") return [];
	const input = state.input as Record<string, unknown> | undefined;
	if (!input || typeof input !== "object") return [];

	const skillName =
		typeof input.name === "string"
			? input.name
			: typeof input.skill === "string"
				? input.skill
				: null;
	if (!skillName) return [];
	if (knownSkills.size > 0 && !knownSkills.has(skillName)) return [];

	return [
		{
			skillName,
			timestamp: new Date(timeCreated).toISOString(),
			sessionId: `kilo:${sessionId}`,
			agent: "kilocode",
		},
	];
}

function countKiloDbSessions(): number {
	const kiloDb = openKiloDb();
	if (!kiloDb) return 0;
	try {
		const row = kiloDb
			.query<{ count: number }, []>("SELECT COUNT(*) as count FROM session")
			.get();
		return row?.count ?? 0;
	} catch {
		return 0;
	} finally {
		kiloDb.close();
	}
}

function scanKiloDb(
	db: Database,
	trackedSet: Set<string>,
	knownSkills: Set<string>,
	cache?: ScanCache,
): number {
	const dbPath = kiloDbPath();
	if (dbPath && cache?.shouldSkip(dbPath)) return 0;
	const kiloDb = openKiloDb();
	if (!kiloDb) return 0;

	try {
		const rows = kiloDb
			.query<KiloPartRow, []>(
				'SELECT p.session_id, p.time_created, p.data FROM part p WHERE p.data LIKE \'%"tool":"skill"%\'',
			)
			.all();

		const invocations: Invocation[] = [];
		for (const row of rows) {
			invocations.push(
				...parseKiloPartData(
					row.session_id,
					row.time_created,
					row.data,
					knownSkills,
				),
			);
		}

		return recordNewInvocations(db, trackedSet, invocations);
	} catch {
		return 0;
	} finally {
		kiloDb.close();
	}
}

export function countKiloSessions(): number {
	return (
		countClineFamilyTasks(kiloLegacyStorageBases()) + countKiloDbSessions()
	);
}

export async function scanKiloSessions(
	db: Database,
	trackedSet: Set<string>,
	knownSkills: Set<string> = new Set(),
	cache?: ScanCache,
	progress?: ProgressReporter,
): Promise<number> {
	const legacy = await scanClineFamilyTasks(
		db,
		trackedSet,
		{
			agent: "kilocode",
			sessionPrefix: "kilo",
			storageBases: kiloLegacyStorageBases(),
		},
		knownSkills,
		cache,
		progress,
	);
	const current = scanKiloDb(db, trackedSet, knownSkills, cache);
	return legacy + current;
}
