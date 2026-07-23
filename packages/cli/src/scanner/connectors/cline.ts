import type { Database } from "bun:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProgressReporter } from "../../tui/progress";
import type { Invocation } from "../index";
import type { ScanCache } from "../scan-cache";
import {
	countClineFamilyTasks,
	parseClineFamilyApiHistory,
	parseClineFamilyUiMessages,
	scanClineFamilyTasks,
	vscodeGlobalStorageBases,
} from "./cline-family";

// Cline (github.com/cline/cline, VS Code publisher saoudrizwan, name claude-dev).
// Task persistence, verified in source:
//   apps/vscode/src/core/storage/disk.ts       GlobalFileNames + getGlobalStorageDir("tasks", taskId)
//   apps/vscode/src/sdk/legacy-state-reader.ts resolveDataDir: CLINE_DATA_DIR > CLINE_DIR/data > ~/.cline/data
//
// VS Code extension (macOS):
//   ~/Library/Application Support/<IDE>/User/globalStorage/saoudrizwan.claude-dev/tasks/<taskId>/
// CLI + JetBrains:
//   ~/.cline/data/tasks/<taskId>/
// Each task dir holds ui_messages.json and api_conversation_history.json.
// Task IDs are Date.now().toString() (shared/services/worker/utils.ts).

const CLINE_EXTENSION_ID = "saoudrizwan.claude-dev";

function clineDataDir(): string {
	if (process.env.CLINE_DATA_DIR) return process.env.CLINE_DATA_DIR;
	const clineDir = process.env.CLINE_DIR || join(homedir(), ".cline");
	return join(clineDir, "data");
}

function clineStorageBases(): string[] {
	return [...vscodeGlobalStorageBases(CLINE_EXTENSION_ID), clineDataDir()];
}

export function parseClineTaskFile(
	filePath: string,
	taskId: string,
	knownSkills: Set<string> = new Set(),
	fallbackTimestamp?: string,
): Invocation[] {
	const sessionId = `cline:${taskId}`;
	const fallback =
		fallbackTimestamp ??
		(/^\d{13}$/.test(taskId)
			? new Date(Number(taskId)).toISOString()
			: new Date().toISOString());
	if (filePath.endsWith("api_conversation_history.json")) {
		return parseClineFamilyApiHistory(
			filePath,
			"cline",
			sessionId,
			knownSkills,
			fallback,
		);
	}
	return parseClineFamilyUiMessages(
		filePath,
		"cline",
		sessionId,
		knownSkills,
		fallback,
	);
}

export function countClineSessions(): number {
	return countClineFamilyTasks(clineStorageBases());
}

export async function scanClineSessions(
	db: Database,
	trackedSet: Set<string>,
	knownSkills: Set<string> = new Set(),
	cache?: ScanCache,
	progress?: ProgressReporter,
): Promise<number> {
	return scanClineFamilyTasks(
		db,
		trackedSet,
		{
			agent: "cline",
			sessionPrefix: "cline",
			storageBases: clineStorageBases(),
		},
		knownSkills,
		cache,
		progress,
	);
}
