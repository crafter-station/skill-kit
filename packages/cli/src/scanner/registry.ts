import type { Connector } from "./connector";
import { defineConnector } from "./connector";
import { countClaudeSessions, scanClaudeSessions } from "./connectors/claude";
import { countCodexSessions, scanCodexSessions } from "./connectors/codex";
import { countCursorSessions, scanCursorSessions } from "./connectors/cursor";
import { countGeminiSessions, scanGeminiSessions } from "./connectors/gemini";
import {
	countOpenCodeSessions,
	scanOpenCodeSessions,
} from "./connectors/opencode";

export const connectors: Connector[] = [
	defineConnector({
		id: "claude",
		displayName: "Claude Code",
		sessionFormat: "jsonl-files",
		sessionSource: "~/.claude/projects/**/*.jsonl",
		count: countClaudeSessions,
		scan: (db, trackedSet, knownSkills, cache, progress) =>
			scanClaudeSessions(db, trackedSet, knownSkills, cache, progress),
	}),
	defineConnector({
		id: "opencode",
		displayName: "OpenCode",
		sessionFormat: "sqlite",
		sessionSource: "opencode.db (XDG data dir)",
		count: countOpenCodeSessions,
		scan: (db, trackedSet, _knownSkills, cache) =>
			scanOpenCodeSessions(db, trackedSet, cache),
	}),
	defineConnector({
		id: "cursor",
		displayName: "Cursor",
		sessionFormat: "jsonl-files",
		sessionSource: "~/.cursor/projects/**/*.jsonl",
		count: countCursorSessions,
		scan: (db, trackedSet, knownSkills, cache, progress) =>
			scanCursorSessions(db, trackedSet, knownSkills, cache, progress),
	}),
	defineConnector({
		id: "codex",
		displayName: "Codex",
		sessionFormat: "jsonl-files",
		sessionSource: "~/.codex/sessions/**/*.jsonl",
		count: countCodexSessions,
		scan: (db, trackedSet, knownSkills, cache, progress) =>
			scanCodexSessions(db, trackedSet, knownSkills, cache, progress),
	}),
	defineConnector({
		id: "gemini",
		displayName: "Gemini CLI",
		sessionFormat: "json-files",
		sessionSource: "~/.gemini/tmp/**/chats/session-*.json",
		count: countGeminiSessions,
		scan: (db, trackedSet, knownSkills, cache, progress) =>
			scanGeminiSessions(db, trackedSet, knownSkills, cache, progress),
	}),
];

export function getConnector(id: string): Connector | undefined {
	return connectors.find((c) => c.id === id);
}
