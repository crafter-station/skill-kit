import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

interface ClaudeSettings {
	hooks?: {
		SessionEnd?: Array<{
			hooks: Array<{
				type: string;
				command: string;
				timeout?: number;
				async?: boolean;
			}>;
		}>;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

function loadSettings(): ClaudeSettings {
	try {
		if (existsSync(SETTINGS_PATH)) {
			return JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
		}
	} catch {}
	return {};
}

function saveSettings(settings: ClaudeSettings): void {
	writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

const HOOK_COMMAND = "skillkit scan --quiet";

export function isHookInstalled(): boolean {
	const settings = loadSettings();
	const sessionEnd = settings.hooks?.SessionEnd;
	if (!Array.isArray(sessionEnd)) return false;
	return sessionEnd.some((entry) =>
		entry.hooks?.some((h) => h.command === HOOK_COMMAND),
	);
}

export function installHook(): boolean {
	if (isHookInstalled()) return false;

	const settings = loadSettings();
	if (!settings.hooks) settings.hooks = {};
	if (!Array.isArray(settings.hooks.SessionEnd)) settings.hooks.SessionEnd = [];

	settings.hooks.SessionEnd.push({
		hooks: [
			{
				type: "command",
				command: HOOK_COMMAND,
				timeout: 120,
				async: true,
			},
		],
	});

	saveSettings(settings);
	return true;
}

export function removeHook(): boolean {
	if (!isHookInstalled()) return false;

	const settings = loadSettings();
	const sessionEnd = settings.hooks?.SessionEnd;
	if (!Array.isArray(sessionEnd)) return false;

	settings.hooks!.SessionEnd = sessionEnd.filter(
		(entry) => !entry.hooks?.some((h) => h.command === HOOK_COMMAND),
	);

	if (settings.hooks!.SessionEnd.length === 0) {
		delete settings.hooks!.SessionEnd;
	}

	saveSettings(settings);
	return true;
}
