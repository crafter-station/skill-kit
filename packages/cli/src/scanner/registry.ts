import type { Connector } from "./connector";
import { defineConnector } from "./connector";
import { countAmpSessions, scanAmpSessions } from "./connectors/amp";
import { countClaudeSessions, scanClaudeSessions } from "./connectors/claude";
import { countClineSessions, scanClineSessions } from "./connectors/cline";
import { countCodexSessions, scanCodexSessions } from "./connectors/codex";
import { countCursorSessions, scanCursorSessions } from "./connectors/cursor";
import { countGeminiSessions, scanGeminiSessions } from "./connectors/gemini";
import {
	countContinueSessions,
	scanContinueSessions,
} from "./connectors/continue";
import {
	countCopilotSessions,
	scanCopilotSessions,
} from "./connectors/copilot";
import { countGooseSessions, scanGooseSessions } from "./connectors/goose";
import { countKiloSessions, scanKiloSessions } from "./connectors/kilocode";
import {
	countOpenCodeSessions,
	scanOpenCodeSessions,
} from "./connectors/opencode";
import {
	countOpenHandsSessions,
	scanOpenHandsSessions,
} from "./connectors/openhands";
import { countRooSessions, scanRooSessions } from "./connectors/roo";
import {
	countWindsurfSessions,
	scanWindsurfSessions,
} from "./connectors/windsurf";

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
	defineConnector({
		id: "amp",
		displayName: "Amp",
		sessionFormat: "json-files",
		sessionSource:
			"$XDG_DATA_HOME/amp/threads/*.json (legacy; modern Amp is server-side)",
		count: countAmpSessions,
		scan: (db, trackedSet, knownSkills, cache, progress) =>
			scanAmpSessions(db, trackedSet, knownSkills, cache, progress),
	}),
	defineConnector({
		id: "cline",
		displayName: "Cline",
		sessionFormat: "json-files",
		sessionSource: "globalStorage/saoudrizwan.claude-dev/tasks + ~/.cline/data/tasks",
		count: countClineSessions,
		scan: (db, trackedSet, knownSkills, cache, progress) =>
			scanClineSessions(db, trackedSet, knownSkills, cache, progress),
	}),
	defineConnector({
		id: "roo",
		displayName: "Roo Code",
		sessionFormat: "json-files",
		sessionSource: "globalStorage/RooVeterinaryInc.roo-cline/tasks + ~/.vscode-mock",
		count: countRooSessions,
		scan: (db, trackedSet, knownSkills, cache, progress) =>
			scanRooSessions(db, trackedSet, knownSkills, cache, progress),
	}),
	defineConnector({
		id: "kilocode",
		displayName: "Kilo Code",
		sessionFormat: "sqlite",
		sessionSource: "~/.local/share/kilo/kilo.db + legacy globalStorage tasks",
		count: countKiloSessions,
		scan: (db, trackedSet, knownSkills, cache, progress) =>
			scanKiloSessions(db, trackedSet, knownSkills, cache, progress),
	}),
	defineConnector({
		id: "copilot",
		displayName: "GitHub Copilot CLI",
		sessionFormat: "jsonl-files",
		sessionSource: "~/.copilot/session-state/*/events.jsonl",
		count: countCopilotSessions,
		scan: (db, trackedSet, knownSkills, cache, progress) =>
			scanCopilotSessions(db, trackedSet, knownSkills, cache, progress),
	}),
	defineConnector({
		id: "openhands",
		displayName: "OpenHands",
		sessionFormat: "json-files",
		sessionSource: "~/.openhands/{conversations,v1_conversations}/*",
		count: countOpenHandsSessions,
		scan: (db, trackedSet, knownSkills, cache, progress) =>
			scanOpenHandsSessions(db, trackedSet, knownSkills, cache, progress),
	}),
	defineConnector({
		id: "continue",
		displayName: "Continue",
		sessionFormat: "json-files",
		sessionSource: "~/.continue/sessions/*.json",
		count: countContinueSessions,
		scan: (db, trackedSet, knownSkills, cache, progress) =>
			scanContinueSessions(db, trackedSet, knownSkills, cache, progress),
	}),
	defineConnector({
		id: "goose",
		displayName: "Goose",
		sessionFormat: "sqlite",
		sessionSource: "goose sessions.db (XDG data dir) + legacy *.jsonl",
		count: countGooseSessions,
		scan: (db, trackedSet, knownSkills, cache, progress) =>
			scanGooseSessions(db, trackedSet, knownSkills, cache, progress),
	}),
	defineConnector({
		id: "windsurf",
		displayName: "Windsurf",
		sessionFormat: "vscode-state",
		sessionSource: "state.vscdb (Windsurf globalStorage)",
		count: countWindsurfSessions,
		scan: (db, trackedSet, knownSkills, cache) =>
			scanWindsurfSessions(db, trackedSet, knownSkills, cache),
	}),
];

export function getConnector(id: string): Connector | undefined {
	return connectors.find((c) => c.id === id);
}
