import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

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

export interface HookOptions {
	settingsPath?: string;
	executablePath?: string;
	compiled?: boolean;
}

const LEGACY_HOOK_COMMAND = "skillkit scan --quiet";

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function getHookCommand(options: HookOptions = {}): string {
	const compiled = options.compiled ?? Bun.main.startsWith("/$bunfs/");
	const executable = compiled
		? (options.executablePath ?? process.execPath)
		: "skillkit";
	return `${compiled ? shellQuote(executable) : executable} scan --quiet`;
}

function settingsPath(options: HookOptions): string {
	return options.settingsPath ?? join(homedir(), ".claude", "settings.json");
}

function loadSettings(options: HookOptions): ClaudeSettings {
	try {
		const path = settingsPath(options);
		if (existsSync(path)) return JSON.parse(readFileSync(path, "utf-8"));
	} catch {}
	return {};
}

function saveSettings(settings: ClaudeSettings, options: HookOptions): void {
	const path = settingsPath(options);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(settings, null, 2));
}

function isManagedCommand(command: string, options: HookOptions): boolean {
	return command === LEGACY_HOOK_COMMAND || command === getHookCommand(options);
}

export function isHookInstalled(options: HookOptions = {}): boolean {
	const settings = loadSettings(options);
	const sessionEnd = settings.hooks?.SessionEnd;
	if (!Array.isArray(sessionEnd)) return false;
	return sessionEnd.some((entry) =>
		entry.hooks?.some((hook) => isManagedCommand(hook.command, options)),
	);
}

export function installHook(options: HookOptions = {}): boolean {
	const command = getHookCommand(options);
	const settings = loadSettings(options);
	if (!settings.hooks) settings.hooks = {};
	if (!Array.isArray(settings.hooks.SessionEnd)) settings.hooks.SessionEnd = [];
	if (
		settings.hooks.SessionEnd.some((entry) =>
			entry.hooks?.some((hook) => hook.command === command),
		)
	) {
		return false;
	}

	settings.hooks.SessionEnd = settings.hooks.SessionEnd.map((entry) => ({
		...entry,
		hooks: entry.hooks.filter((hook) => hook.command !== LEGACY_HOOK_COMMAND),
	})).filter((entry) => entry.hooks.length > 0);
	settings.hooks.SessionEnd.push({
		hooks: [
			{
				type: "command",
				command,
				timeout: 120,
				async: true,
			},
		],
	});

	saveSettings(settings, options);
	return true;
}

export function removeHook(options: HookOptions = {}): boolean {
	const settings = loadSettings(options);
	const hooks = settings.hooks;
	const sessionEnd = hooks?.SessionEnd;
	if (!hooks || !Array.isArray(sessionEnd)) return false;
	let removed = false;
	const next = sessionEnd
		.map((entry) => ({
			...entry,
			hooks: entry.hooks.filter((hook) => {
				const managed = isManagedCommand(hook.command, options);
				if (managed) removed = true;
				return !managed;
			}),
		}))
		.filter((entry) => entry.hooks.length > 0);
	if (!removed) return false;

	hooks.SessionEnd = next;
	if (next.length === 0) delete hooks.SessionEnd;
	saveSettings(settings, options);
	return true;
}
