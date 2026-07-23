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

// Roo Code (github.com/RooCodeInc/Roo-Code, publisher RooVeterinaryInc, name roo-cline).
// Cline fork; keeps the same task-directory layout. Verified in source:
//   src/shared/globalFileNames.ts                    api_conversation_history.json / ui_messages.json
//   src/core/task-persistence/{apiMessages,taskMessages}.ts
//   src/utils/storage.ts                             getTaskDirectoryPath(globalStoragePath, taskId)
//   apps/cli/src/lib/task-history/index.ts           CLI default ~/.vscode-mock/global-storage
//   packages/core/src/task-history/index.ts          tasks/ subdir under the storage base
//   src/core/tools/SkillTool.ts                      ask "tool" text = {"tool":"skill","skill":name}
//
// VS Code extension (macOS):
//   ~/Library/Application Support/<IDE>/User/globalStorage/RooVeterinaryInc.roo-cline/tasks/<taskId>/
// Roo CLI:
//   ~/.vscode-mock/global-storage/tasks/<taskId>/
// Roo task IDs are uuidv7 (src/core/task/Task.ts:454); Roo ApiMessage carries
// a per-message `ts` (src/core/task-persistence/apiMessages.ts).

const ROO_EXTENSION_ID = "RooVeterinaryInc.roo-cline";

function rooStorageBases(): string[] {
	return [
		...vscodeGlobalStorageBases(ROO_EXTENSION_ID),
		join(homedir(), ".vscode-mock", "global-storage"),
	];
}

export function parseRooTaskFile(
	filePath: string,
	taskId: string,
	knownSkills: Set<string> = new Set(),
	fallbackTimestamp: string = new Date().toISOString(),
): Invocation[] {
	const sessionId = `roo:${taskId}`;
	if (filePath.endsWith("api_conversation_history.json")) {
		return parseClineFamilyApiHistory(
			filePath,
			"roo",
			sessionId,
			knownSkills,
			fallbackTimestamp,
		);
	}
	return parseClineFamilyUiMessages(
		filePath,
		"roo",
		sessionId,
		knownSkills,
		fallbackTimestamp,
	);
}

export function countRooSessions(): number {
	return countClineFamilyTasks(rooStorageBases());
}

export async function scanRooSessions(
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
			agent: "roo",
			sessionPrefix: "roo",
			storageBases: rooStorageBases(),
		},
		knownSkills,
		cache,
		progress,
	);
}
