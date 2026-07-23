import type { Database } from "bun:sqlite";
import { Database as BunDatabase } from "bun:sqlite";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { Invocation } from "../index";
import { recordNewInvocations } from "../index";
import type { ScanCache } from "../scan-cache";

// Windsurf (VS Code fork) persists Cascade/chat state in the standard
// vscode-state SQLite database:
//   macOS:   ~/Library/Application Support/Windsurf/User/globalStorage/state.vscdb
//   Linux:   ~/.config/Windsurf/User/globalStorage/state.vscdb
//   Windows: %APPDATA%/Windsurf/User/globalStorage/state.vscdb
//
// Two surfaces hold conversation data:
//   1. ItemTable rows under chat keys (tabs -> bubbles of text)
//   2. cursorDiskKV rows keyed composerData:/agentData:/flowData: (agent steps)
//
// NOTE: the raw Cascade trajectories in ~/.codeium/windsurf/cascade/*.pb are
// encrypted at rest (entropy ~8.0, no plaintext, no compression magic) and are
// NOT parseable. This connector only reads the vscode-state database.

const WINDSURF_CHAT_KEYS = [
	"workbench.panel.aichat.view.aichat.chatdata",
	"aiChat.chatdata",
	"chat.data",
	"cascade.chatdata",
];

const SKILL_PATH_RE = /skills\/([a-zA-Z][\w-]*)\/SKILL\.md/g;

interface WindsurfBubble {
	type?: string | number;
	text?: string;
	rawText?: string;
	toolCalls?: Array<{ name?: string; args?: Record<string, unknown> }>;
}

interface WindsurfTab {
	tabId?: string;
	chatTitle?: string;
	bubbles?: WindsurfBubble[];
}

interface WindsurfChatData {
	tabs?: WindsurfTab[];
}

interface WindsurfAgentStep {
	type?: number | string;
	role?: string;
	text?: string;
	toolCalls?: Array<{ name?: string; args?: Record<string, unknown> }>;
	toolCall?: { name?: string; args?: Record<string, unknown> };
}

interface WindsurfAgentData {
	name?: string;
	createdAt?: number;
	lastUpdatedAt?: number;
	conversation?: WindsurfAgentStep[];
}

function getWindsurfDbPath(): string | null {
	const os = platform();
	const home = homedir();
	const candidates: string[] = [];

	if (os === "darwin") {
		candidates.push(join(home, "Library", "Application Support", "Windsurf"));
	} else if (os === "win32") {
		candidates.push(
			join(process.env.APPDATA || join(home, "AppData", "Roaming"), "Windsurf"),
		);
	} else {
		candidates.push(
			join(process.env.XDG_CONFIG_HOME || join(home, ".config"), "Windsurf"),
		);
	}

	for (const base of candidates) {
		const dbPath = join(base, "User", "globalStorage", "state.vscdb");
		if (existsSync(dbPath)) return dbPath;
	}
	return null;
}

function openDb(): InstanceType<typeof BunDatabase> | null {
	const dbPath = getWindsurfDbPath();
	if (!dbPath) return null;
	try {
		return new BunDatabase(dbPath, { readonly: true });
	} catch {
		return null;
	}
}

function extractSkillsFromText(
	text: string,
	knownSkills: Set<string>,
	requireKnown = false,
): string[] {
	const found: string[] = [];
	for (const match of text.matchAll(SKILL_PATH_RE)) {
		const name = match[1];
		if (!name) continue;
		if (requireKnown && !knownSkills.has(name)) continue;
		found.push(name);
	}
	if (found.length > 0) return found;

	// Fallback: explicit skill: mentions gated by knownSkills
	const mentionRe = /\bskill:([a-zA-Z][\w-]*)/g;
	for (const match of text.matchAll(mentionRe)) {
		const name = match[1];
		if (name && knownSkills.has(name)) found.push(name);
	}
	return found;
}

function collectStepSkills(
	step: {
		text?: string;
		toolCalls?: Array<{ name?: string; args?: Record<string, unknown> }>;
		toolCall?: { name?: string; args?: Record<string, unknown> };
	},
	knownSkills: Set<string>,
): string[] {
	const names: string[] = [];

	const calls = [
		...(Array.isArray(step.toolCalls) ? step.toolCalls : []),
		...(step.toolCall ? [step.toolCall] : []),
	];
	for (const call of calls) {
		if (typeof call?.name !== "string") continue;
		if (knownSkills.has(call.name)) {
			names.push(call.name);
			continue;
		}
		const args = call.args ? JSON.stringify(call.args) : "";
		names.push(...extractSkillsFromText(args, knownSkills));
	}

	if (typeof step.text === "string" && step.text.length > 0) {
		// Plain prose: a SKILL.md path mention is not proof of execution, so
		// gate by knownSkills to avoid recording skills the user never had.
		names.push(...extractSkillsFromText(step.text, knownSkills, true));
	}

	return names;
}

// Chat bubbles carry no timestamp. A wall-clock fallback would mint a new
// dedupe key on every scan and re-record the whole history without bound,
// so we derive a deterministic synthetic timestamp from the tab id: the
// same invocation always maps to the same key. The date is marked clearly
// synthetic (epoch year 2001) rather than pretending to be real.
function syntheticTabTimestamp(tabKey: string, bubbleIndex: number): string {
	let hash = 0;
	for (let i = 0; i < tabKey.length; i++) {
		hash = (hash * 31 + tabKey.charCodeAt(i)) | 0;
	}
	const base = Date.UTC(2001, 0, 1) + (Math.abs(hash) % 86_400_000);
	return new Date(base + bubbleIndex * 1000).toISOString();
}

export function parseWindsurfChatData(
	raw: string,
	knownSkills: Set<string> = new Set(),
	fallbackTimestamp?: string,
): Invocation[] {
	const results: Invocation[] = [];

	let data: WindsurfChatData;
	try {
		data = JSON.parse(raw) as WindsurfChatData;
	} catch {
		return results;
	}
	if (!Array.isArray(data.tabs)) return results;

	for (let i = 0; i < data.tabs.length; i++) {
		const tab = data.tabs[i];
		if (!tab || !Array.isArray(tab.bubbles)) continue;
		const tabKey = tab.tabId ?? `tab-${i}`;
		const sessionId = `windsurf:chat:${tabKey}`;

		for (let b = 0; b < tab.bubbles.length; b++) {
			const bubble = tab.bubbles[b];
			if (typeof bubble !== "object" || bubble === null) continue;
			const text = bubble.rawText ?? bubble.text ?? "";
			const skills = collectStepSkills(
				{ text, toolCalls: bubble.toolCalls },
				knownSkills,
			);
			for (const skillName of skills) {
				results.push({
					skillName,
					timestamp: fallbackTimestamp ?? syntheticTabTimestamp(tabKey, b),
					sessionId,
					agent: "windsurf",
				});
			}
		}
	}

	return results;
}

export function parseWindsurfAgentBlob(
	key: string,
	raw: string,
	knownSkills: Set<string> = new Set(),
): Invocation[] {
	const results: Invocation[] = [];

	let data: WindsurfAgentData;
	try {
		data = JSON.parse(raw) as WindsurfAgentData;
	} catch {
		return results;
	}
	if (!Array.isArray(data.conversation)) return results;

	// createdAt is stable across scans; lastUpdatedAt changes while the blob
	// is active and would mint a fresh dedupe key each scan (re-recording the
	// blob's whole history), so it is deliberately NOT used.
	const ts =
		typeof data.createdAt === "number"
			? new Date(data.createdAt).toISOString()
			: syntheticTabTimestamp(key, 0);
	const sessionId = `windsurf:agent:${key}`;

	for (const step of data.conversation) {
		if (typeof step !== "object" || step === null) continue;
		const skills = collectStepSkills(step, knownSkills);
		for (const skillName of skills) {
			results.push({
				skillName,
				timestamp: ts,
				sessionId,
				agent: "windsurf",
			});
		}
	}

	return results;
}

export function countWindsurfSessions(): number {
	const wsDb = openDb();
	if (!wsDb) return 0;

	let count = 0;
	try {
		for (const key of WINDSURF_CHAT_KEYS) {
			try {
				const row = wsDb
					.query<{ value: string }, [string]>(
						"SELECT value FROM ItemTable WHERE key = ?",
					)
					.get(key);
				if (!row) continue;
				const data = JSON.parse(row.value) as WindsurfChatData;
				if (!Array.isArray(data.tabs)) continue;
				for (const tab of data.tabs) {
					if (tab && Array.isArray(tab.bubbles) && tab.bubbles.length > 0) {
						count++;
					}
				}
			} catch {
				// key missing or unparseable -> skip
			}
		}

		try {
			const hasKv = wsDb
				.query<{ name: string }, []>(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='cursorDiskKV'",
				)
				.get();
			if (hasKv) {
				const row = wsDb
					.query<{ count: number }, []>(
						"SELECT COUNT(*) as count FROM cursorDiskKV WHERE key LIKE 'composerData:%' OR key LIKE 'agentData:%' OR key LIKE 'flowData:%'",
					)
					.get();
				count += row?.count ?? 0;
			}
		} catch {
			// table probe failed -> chat count only
		}

		return count;
	} catch {
		return 0;
	} finally {
		wsDb.close();
	}
}

export function scanWindsurfSessions(
	db: Database,
	trackedSet: Set<string>,
	knownSkills: Set<string> = new Set(),
	cache?: ScanCache,
): number {
	const dbPath = getWindsurfDbPath();
	if (dbPath && cache?.shouldSkip(dbPath)) return 0;
	const wsDb = openDb();
	if (!wsDb) return 0;

	try {
		const invocations: Invocation[] = [];

		for (const key of WINDSURF_CHAT_KEYS) {
			try {
				const row = wsDb
					.query<{ value: string }, [string]>(
						"SELECT value FROM ItemTable WHERE key = ?",
					)
					.get(key);
				if (!row) continue;
				invocations.push(...parseWindsurfChatData(row.value, knownSkills));
			} catch {
				// key missing or corrupt -> skip
			}
		}

		try {
			const hasKv = wsDb
				.query<{ name: string }, []>(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='cursorDiskKV'",
				)
				.get();
			if (hasKv) {
				const rows = wsDb
					.query<{ key: string; value: string }, []>(
						"SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%' OR key LIKE 'agentData:%' OR key LIKE 'flowData:%'",
					)
					.all();
				for (const row of rows) {
					invocations.push(
						...parseWindsurfAgentBlob(row.key, row.value, knownSkills),
					);
				}
			}
		} catch {
			// table probe failed -> chat data only
		}

		return recordNewInvocations(db, trackedSet, invocations);
	} catch {
		return 0;
	} finally {
		wsDb.close();
	}
}
