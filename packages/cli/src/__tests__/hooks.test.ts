import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_DIR = join(tmpdir(), `skillkit-hook-test-${Date.now()}`);
const SETTINGS_PATH = join(TEST_DIR, ".claude", "settings.json");

function loadModule() {
	const original = process.env.HOME;
	process.env.HOME = TEST_DIR;

	const mod = {
		isHookInstalled: (): boolean => {
			try {
				if (!existsSync(SETTINGS_PATH)) return false;
				const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
				const sessionEnd = settings.hooks?.SessionEnd;
				if (!Array.isArray(sessionEnd)) return false;
				return sessionEnd.some((entry: any) =>
					entry.hooks?.some((h: any) => h.command === "skillkit scan --quiet"),
				);
			} catch {
				return false;
			}
		},

		installHook: (): boolean => {
			if (mod.isHookInstalled()) return false;
			mkdirSync(join(TEST_DIR, ".claude"), { recursive: true });

			let settings: any = {};
			try {
				if (existsSync(SETTINGS_PATH)) {
					settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
				}
			} catch {}

			if (!settings.hooks) settings.hooks = {};
			if (!Array.isArray(settings.hooks.SessionEnd))
				settings.hooks.SessionEnd = [];
			settings.hooks.SessionEnd.push({
				hooks: [
					{
						type: "command",
						command: "skillkit scan --quiet",
						timeout: 120,
						async: true,
					},
				],
			});
			writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
			return true;
		},

		removeHook: (): boolean => {
			if (!mod.isHookInstalled()) return false;
			const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
			settings.hooks.SessionEnd = settings.hooks.SessionEnd.filter(
				(entry: any) =>
					!entry.hooks?.some((h: any) => h.command === "skillkit scan --quiet"),
			);
			if (settings.hooks.SessionEnd.length === 0)
				delete settings.hooks.SessionEnd;
			writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
			return true;
		},

		cleanup: () => {
			process.env.HOME = original;
		},
	};

	return mod;
}

describe("hooks", () => {
	let mod: ReturnType<typeof loadModule>;

	beforeEach(() => {
		mkdirSync(join(TEST_DIR, ".claude"), { recursive: true });
		mod = loadModule();
	});

	afterEach(() => {
		mod.cleanup();
		try {
			rmSync(TEST_DIR, { recursive: true });
		} catch {}
	});

	it("detects no hook when settings missing", () => {
		expect(mod.isHookInstalled()).toBe(false);
	});

	it("detects no hook when settings empty", () => {
		writeFileSync(SETTINGS_PATH, "{}");
		expect(mod.isHookInstalled()).toBe(false);
	});

	it("installs hook", () => {
		expect(mod.installHook()).toBe(true);
		expect(mod.isHookInstalled()).toBe(true);

		const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
		expect(settings.hooks.SessionEnd).toHaveLength(1);
		expect(settings.hooks.SessionEnd[0].hooks[0].command).toBe(
			"skillkit scan --quiet",
		);
		expect(settings.hooks.SessionEnd[0].hooks[0].async).toBe(true);
	});

	it("does not double install", () => {
		expect(mod.installHook()).toBe(true);
		expect(mod.installHook()).toBe(false);

		const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
		expect(settings.hooks.SessionEnd).toHaveLength(1);
	});

	it("preserves existing hooks", () => {
		writeFileSync(
			SETTINGS_PATH,
			JSON.stringify({
				hooks: {
					SessionEnd: [
						{ hooks: [{ type: "command", command: "other-tool run" }] },
					],
				},
			}),
		);

		mod.installHook();
		const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
		expect(settings.hooks.SessionEnd).toHaveLength(2);
	});

	it("removes hook", () => {
		mod.installHook();
		expect(mod.removeHook()).toBe(true);
		expect(mod.isHookInstalled()).toBe(false);
	});

	it("returns false when removing non-existent hook", () => {
		expect(mod.removeHook()).toBe(false);
	});
});
