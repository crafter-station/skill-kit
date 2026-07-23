import type { Database } from "bun:sqlite";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { ProgressReporter } from "../../tui/progress";
import type { Invocation } from "../index";
import { recordNewInvocations } from "../index";
import type { ScanCache } from "../scan-cache";

// Shared parser for the Cline lineage (Cline, Roo Code, Kilo Code legacy).
// All three persist one directory per task containing:
//   ui_messages.json              ClineMessage[] ({ts, type: "say"|"ask", say/ask, text})
//   api_conversation_history.json Anthropic.MessageParam[] (Roo adds a `ts` per message)
//
// Source of truth (verified against upstream source, 2026-07):
//   cline:  apps/vscode/src/core/storage/disk.ts (GlobalFileNames),
//           apps/vscode/src/sdk/legacy-state-reader.ts (CLI paths ~/.cline/data),
//           apps/vscode/src/shared/ExtensionMessage.ts (ClineMessage, ClineSayTool
//           with tool: "useSkill" and skill name in `path`),
//           apps/vscode/src/shared/tools.ts (ClineDefaultTool.USE_SKILL = "use_skill")
//   roo:    src/shared/globalFileNames.ts, src/core/task-persistence/{apiMessages,taskMessages}.ts,
//           src/core/tools/SkillTool.ts + src/services/skills/skillInvocation.ts
//           (ask "tool" text = {"tool":"skill","skill":name,...})
//   kilo:   packages/kilo-vscode/src/legacy-migration/task-store.ts (same layout, legacy)

const SKILL_PATH_RE = /skills\/([a-zA-Z][\w-]*)\/SKILL\.md/g;
const XML_SKILL_RE =
	/<(use_skill|skill|skills)>[\s\S]*?<(?:skill_name|skill|name)>([^<]+)<\/(?:skill_name|skill|name)>[\s\S]*?<\/\1>/g;

interface ClineFamilyMessage {
	ts?: number;
	type?: string;
	say?: string;
	ask?: string;
	text?: string;
}

interface ApiContentBlock {
	type?: string;
	name?: string;
	text?: string;
	input?: Record<string, unknown>;
}

interface ApiMessage {
	role?: string;
	ts?: number;
	content?: string | ApiContentBlock[];
}

function pushSkill(
	results: Invocation[],
	seen: Set<string>,
	skillName: string,
	knownSkills: Set<string>,
	requireKnown: boolean,
	timestamp: string,
	sessionId: string,
	agent: string,
): void {
	const name = skillName.trim();
	if (!name) return;
	if (requireKnown && !knownSkills.has(name)) return;
	const key = `${sessionId}:${name}:${timestamp}`;
	if (seen.has(key)) return;
	seen.add(key);
	results.push({ skillName: name, timestamp, sessionId, agent });
}

function extractSkillsFromText(text: string): string[] {
	const found: string[] = [];
	for (const match of text.matchAll(SKILL_PATH_RE)) {
		if (match[1]) found.push(match[1]);
	}
	for (const match of text.matchAll(XML_SKILL_RE)) {
		if (match[2]) found.push(match[2]);
	}
	return found;
}

function taskFallbackTimestamp(taskId: string, fileMtimeMs?: number): string {
	// Cline task IDs are Date.now().toString() (shared/services/worker/utils.ts);
	// Roo uses uuidv7, so fall back to the file mtime there.
	if (/^\d{13}$/.test(taskId)) {
		return new Date(Number(taskId)).toISOString();
	}
	if (fileMtimeMs && Number.isFinite(fileMtimeMs)) {
		return new Date(fileMtimeMs).toISOString();
	}
	return new Date().toISOString();
}

/**
 * Parse a ui_messages.json file from any Cline-family agent.
 * Skill signals:
 *   - say/ask "tool" messages whose text is ClineSayTool JSON:
 *       {"tool":"useSkill","path":"<name>"}          (Cline)
 *       {"tool":"skill","skill":"<name>", ...}       (Roo / Kilo legacy)
 *   - SKILL.md path reads and XML skill tool calls embedded in message text.
 */
export function parseClineFamilyUiMessages(
	filePath: string,
	agent: string,
	sessionId: string,
	knownSkills: Set<string> = new Set(),
	fallbackTimestamp: string = new Date().toISOString(),
): Invocation[] {
	const results: Invocation[] = [];
	const seen = new Set<string>();

	let content: string;
	try {
		content = readFileSync(filePath, "utf-8");
	} catch {
		return results;
	}

	let messages: unknown;
	try {
		messages = JSON.parse(content);
	} catch {
		return results;
	}
	if (!Array.isArray(messages)) return results;

	for (const raw of messages) {
		if (typeof raw !== "object" || raw === null) continue;
		const msg = raw as ClineFamilyMessage;
		const timestamp =
			typeof msg.ts === "number" && Number.isFinite(msg.ts)
				? new Date(msg.ts).toISOString()
				: fallbackTimestamp;

		if (typeof msg.text !== "string" || msg.text.length === 0) continue;

		const isToolMessage = msg.say === "tool" || msg.ask === "tool";
		if (isToolMessage) {
			let toolData: Record<string, unknown> | null = null;
			try {
				const parsed = JSON.parse(msg.text);
				if (typeof parsed === "object" && parsed !== null) {
					toolData = parsed as Record<string, unknown>;
				}
			} catch {
				// tool text is not JSON -> fall through to text extraction below
			}

			if (toolData) {
				if (
					toolData.tool === "useSkill" &&
					typeof toolData.path === "string" &&
					toolData.path.length > 0
				) {
					pushSkill(
						results,
						seen,
						toolData.path,
						knownSkills,
						knownSkills.size > 0,
						timestamp,
						sessionId,
						agent,
					);
					continue;
				}
				if (
					toolData.tool === "skill" &&
					typeof toolData.skill === "string" &&
					toolData.skill.length > 0
				) {
					pushSkill(
						results,
						seen,
						toolData.skill,
						knownSkills,
						knownSkills.size > 0,
						timestamp,
						sessionId,
						agent,
					);
					continue;
				}
				if (
					(toolData.tool === "readFile" ||
						toolData.tool === "newFileCreated") &&
					typeof toolData.path === "string"
				) {
					for (const name of extractSkillsFromText(toolData.path)) {
						pushSkill(
							results,
							seen,
							name,
							knownSkills,
							true,
							timestamp,
							sessionId,
							agent,
						);
					}
					continue;
				}
			}
		}

		for (const name of extractSkillsFromText(msg.text)) {
			pushSkill(
				results,
				seen,
				name,
				knownSkills,
				true,
				timestamp,
				sessionId,
				agent,
			);
		}
	}

	return results;
}

/**
 * Parse an api_conversation_history.json file (Anthropic.MessageParam[]).
 * Skill signals:
 *   - native tool_use blocks named use_skill/skill/skills with the skill in
 *     input.skill_name / input.skill / input.name
 *   - XML tool calls and SKILL.md reads embedded in assistant text blocks
 */
export function parseClineFamilyApiHistory(
	filePath: string,
	agent: string,
	sessionId: string,
	knownSkills: Set<string> = new Set(),
	fallbackTimestamp: string = new Date().toISOString(),
): Invocation[] {
	const results: Invocation[] = [];
	const seen = new Set<string>();

	let content: string;
	try {
		content = readFileSync(filePath, "utf-8");
	} catch {
		return results;
	}

	let messages: unknown;
	try {
		messages = JSON.parse(content);
	} catch {
		return results;
	}
	if (!Array.isArray(messages)) return results;

	for (const raw of messages) {
		if (typeof raw !== "object" || raw === null) continue;
		const msg = raw as ApiMessage;
		const timestamp =
			typeof msg.ts === "number" && Number.isFinite(msg.ts)
				? new Date(msg.ts).toISOString()
				: fallbackTimestamp;

		const blocks: ApiContentBlock[] =
			typeof msg.content === "string"
				? [{ type: "text", text: msg.content }]
				: Array.isArray(msg.content)
					? msg.content
					: [];

		for (const block of blocks) {
			if (typeof block !== "object" || block === null) continue;

			if (block.type === "tool_use" && typeof block.name === "string") {
				if (
					block.name === "use_skill" ||
					block.name === "skill" ||
					block.name === "skills"
				) {
					const input = block.input ?? {};
					const skillName =
						typeof input.skill_name === "string"
							? input.skill_name
							: typeof input.skill === "string"
								? input.skill
								: typeof input.name === "string"
									? input.name
									: null;
					if (skillName) {
						pushSkill(
							results,
							seen,
							skillName,
							knownSkills,
							knownSkills.size > 0,
							timestamp,
							sessionId,
							agent,
						);
					}
					continue;
				}
				if (knownSkills.has(block.name)) {
					pushSkill(
						results,
						seen,
						block.name,
						knownSkills,
						true,
						timestamp,
						sessionId,
						agent,
					);
					continue;
				}
			}

			if (typeof block.text === "string" && block.text.length > 0) {
				for (const name of extractSkillsFromText(block.text)) {
					pushSkill(
						results,
						seen,
						name,
						knownSkills,
						true,
						timestamp,
						sessionId,
						agent,
					);
				}
			}
		}
	}

	return results;
}

export interface ClineFamilyTaskFile {
	filePath: string;
	taskId: string;
	kind: "ui" | "api";
}

/**
 * VS Code variants whose globalStorage may host the extension. Verified base
 * for the family: cline apps/vscode uses the standard VS Code globalStorage;
 * kilo packages/opencode/src/kilocode/paths.ts hardcodes the same layout.
 */
const VSCODE_VARIANT_DIRS_DARWIN = [
	"Code",
	"Code - Insiders",
	"Cursor",
	"VSCodium",
	"Windsurf",
];
const VSCODE_VARIANT_DIRS_LINUX = VSCODE_VARIANT_DIRS_DARWIN;
const VSCODE_VARIANT_DIRS_WIN = VSCODE_VARIANT_DIRS_DARWIN;

export function vscodeGlobalStorageBases(extensionId: string): string[] {
	const os = platform();
	const home = homedir();
	const bases: string[] = [];

	if (os === "darwin") {
		for (const variant of VSCODE_VARIANT_DIRS_DARWIN) {
			bases.push(
				join(
					home,
					"Library",
					"Application Support",
					variant,
					"User",
					"globalStorage",
					extensionId,
				),
			);
		}
	} else if (os === "win32") {
		const appData = process.env.APPDATA || join(home, "AppData", "Roaming");
		for (const variant of VSCODE_VARIANT_DIRS_WIN) {
			bases.push(join(appData, variant, "User", "globalStorage", extensionId));
		}
	} else {
		const configHome = process.env.XDG_CONFIG_HOME || join(home, ".config");
		for (const variant of VSCODE_VARIANT_DIRS_LINUX) {
			bases.push(
				join(configHome, variant, "User", "globalStorage", extensionId),
			);
		}
	}
	return bases;
}

/** List task conversation files under a set of storage bases (each base contains tasks/<taskId>/). */
export function listClineFamilyTaskFiles(
	storageBases: string[],
): ClineFamilyTaskFile[] {
	const files: ClineFamilyTaskFile[] = [];
	for (const base of storageBases) {
		const tasksDir = join(base, "tasks");
		if (!existsSync(tasksDir)) continue;

		let entries: string[];
		try {
			entries = readdirSync(tasksDir);
		} catch {
			continue;
		}

		for (const taskId of entries) {
			if (taskId.startsWith("_") || taskId.startsWith(".")) continue;
			const taskDir = join(tasksDir, taskId);
			const ui = join(taskDir, "ui_messages.json");
			const api = join(taskDir, "api_conversation_history.json");
			// ui_messages is the canonical view (real per-message ts) and covers
			// the same conversation as api_conversation_history; parsing both
			// double-records every invocation under two timestamps. Only fall
			// back to the api file when the ui file is missing.
			if (existsSync(ui)) {
				files.push({ filePath: ui, taskId, kind: "ui" });
			} else if (existsSync(api)) {
				files.push({ filePath: api, taskId, kind: "api" });
			}
		}
	}
	return files;
}

export function countClineFamilyTasks(storageBases: string[]): number {
	const seen = new Set<string>();
	for (const file of listClineFamilyTaskFiles(storageBases)) {
		seen.add(file.taskId);
	}
	return seen.size;
}

export async function scanClineFamilyTasks(
	db: Database,
	trackedSet: Set<string>,
	options: {
		agent: string;
		sessionPrefix: string;
		storageBases: string[];
	},
	knownSkills: Set<string> = new Set(),
	cache?: ScanCache,
	progress?: ProgressReporter,
): Promise<number> {
	const files = listClineFamilyTaskFiles(options.storageBases);

	let total = 0;
	let done = 0;
	for (const file of files) {
		done++;
		if (cache?.shouldSkip(file.filePath)) {
			progress?.update(done, files.length);
			continue;
		}

		let mtimeMs: number | undefined;
		try {
			mtimeMs = statSync(file.filePath).mtimeMs;
		} catch {
			mtimeMs = undefined;
		}
		const fallback = taskFallbackTimestamp(file.taskId, mtimeMs);
		const sessionId = `${options.sessionPrefix}:${file.taskId}`;

		const invocations =
			file.kind === "ui"
				? parseClineFamilyUiMessages(
						file.filePath,
						options.agent,
						sessionId,
						knownSkills,
						fallback,
					)
				: parseClineFamilyApiHistory(
						file.filePath,
						options.agent,
						sessionId,
						knownSkills,
						fallback,
					);
		total += recordNewInvocations(db, trackedSet, invocations);
		progress?.update(done, files.length);
	}
	progress?.finish();

	return total;
}
