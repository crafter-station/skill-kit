import { describe, expect, test } from "bun:test";
import packageJson from "../../package.json";
import { parseSkillsArgs } from "../commands/skills";
import {
	BUNDLED_SKILLS,
	getBundledSkill,
	renderBundledSkill,
} from "../skills/catalog";

describe("bundled skills", () => {
	test("ships core at the CLI version", () => {
		const core = getBundledSkill("core");
		expect(core).toBeDefined();
		expect(core?.version).toBe(packageJson.version);
		expect(BUNDLED_SKILLS).toHaveLength(1);
	});

	test("loads references only with full disclosure", () => {
		const core = getBundledSkill("core");
		if (!core) throw new Error("core skill missing");
		expect(renderBundledSkill(core, false)).not.toContain(
			"# references/commands.md",
		);
		expect(renderBundledSkill(core, true)).toContain(
			"# references/commands.md",
		);
	});
});

describe("skills arguments", () => {
	test("defaults to list", () => {
		expect(parseSkillsArgs([])).toEqual({
			action: "list",
			full: false,
			json: false,
		});
	});

	test("parses get with full JSON output", () => {
		expect(parseSkillsArgs(["get", "core", "--full", "--json"])).toEqual({
			action: "get",
			name: "core",
			full: true,
			json: true,
		});
	});

	test("rejects unknown flags and missing names", () => {
		expect(() => parseSkillsArgs(["get"])).toThrow("No skill name provided");
		expect(() => parseSkillsArgs(["list", "--wat"])).toThrow(
			"Unknown flag: --wat",
		);
	});
});
