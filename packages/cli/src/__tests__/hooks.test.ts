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
import {
	getHookCommand,
	installHook,
	isHookInstalled,
	removeHook,
} from "../lib/hooks";

const TEST_DIR = join(tmpdir(), `skillkit-hook-test-${Date.now()}`);
const SETTINGS_PATH = join(TEST_DIR, ".claude", "settings.json");
const OPTIONS = {
	settingsPath: SETTINGS_PATH,
	executablePath: "/Users/test/.local/bin/skillkit",
	compiled: true,
};

describe("hooks", () => {
	beforeEach(() => {
		mkdirSync(join(TEST_DIR, ".claude"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
	});

	it("uses the absolute compiled executable path", () => {
		expect(getHookCommand(OPTIONS)).toBe(
			"'/Users/test/.local/bin/skillkit' scan --quiet",
		);
		expect(
			getHookCommand({ ...OPTIONS, executablePath: "/Users/test/Skill Kit" }),
		).toBe("'/Users/test/Skill Kit' scan --quiet");
	});

	it("uses the command name during source execution", () => {
		expect(getHookCommand({ ...OPTIONS, compiled: false })).toBe(
			"skillkit scan --quiet",
		);
	});

	it("detects no hook when settings are missing or empty", () => {
		expect(isHookInstalled(OPTIONS)).toBe(false);
		writeFileSync(SETTINGS_PATH, "{}");
		expect(isHookInstalled(OPTIONS)).toBe(false);
	});

	it("installs an absolute-path hook", () => {
		expect(installHook(OPTIONS)).toBe(true);
		expect(isHookInstalled(OPTIONS)).toBe(true);

		const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
		expect(settings.hooks.SessionEnd).toHaveLength(1);
		expect(settings.hooks.SessionEnd[0].hooks[0].command).toBe(
			"'/Users/test/.local/bin/skillkit' scan --quiet",
		);
		expect(settings.hooks.SessionEnd[0].hooks[0].async).toBe(true);
	});

	it("does not double install", () => {
		expect(installHook(OPTIONS)).toBe(true);
		expect(installHook(OPTIONS)).toBe(false);

		const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
		expect(settings.hooks.SessionEnd).toHaveLength(1);
	});

	it("migrates the legacy command and preserves unrelated hooks", () => {
		writeFileSync(
			SETTINGS_PATH,
			JSON.stringify({
				hooks: {
					SessionEnd: [
						{ hooks: [{ type: "command", command: "other-tool run" }] },
						{
							hooks: [{ type: "command", command: "skillkit scan --quiet" }],
						},
					],
				},
			}),
		);

		expect(installHook(OPTIONS)).toBe(true);
		const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
		expect(settings.hooks.SessionEnd).toHaveLength(2);
		expect(JSON.stringify(settings)).toContain("other-tool run");
		expect(JSON.stringify(settings)).not.toContain(
			'"command":"skillkit scan --quiet"',
		);
		expect(isHookInstalled(OPTIONS)).toBe(true);
	});

	it("removes current and legacy hooks", () => {
		installHook(OPTIONS);
		expect(removeHook(OPTIONS)).toBe(true);
		expect(isHookInstalled(OPTIONS)).toBe(false);

		writeFileSync(
			SETTINGS_PATH,
			JSON.stringify({
				hooks: {
					SessionEnd: [
						{
							hooks: [{ type: "command", command: "skillkit scan --quiet" }],
						},
					],
				},
			}),
		);
		expect(removeHook(OPTIONS)).toBe(true);
		expect(isHookInstalled(OPTIONS)).toBe(false);
	});

	it("returns false when removing a non-existent hook", () => {
		expect(removeHook(OPTIONS)).toBe(false);
	});
});
