import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCodexSessionFile } from "../scanner/connectors/codex";

function writeSession(lines: object[]): string {
	const dir = mkdtempSync(join(tmpdir(), "skillkit-codex-"));
	const file = join(dir, "rollout-test.jsonl");
	writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n"));
	return file;
}

function fnCall(name: string, args = "{}") {
	return {
		timestamp: "2026-07-18T00:00:00.000Z",
		type: "response_item",
		payload: { type: "function_call", name, arguments: args },
	};
}

describe("parseCodexSessionFile strict gate", () => {
	it("ignores tool calls when knownSkills is empty", () => {
		const file = writeSession([
			fnCall("wait"),
			fnCall("view_image"),
			fnCall("firecrawl_search"),
		]);
		expect(parseCodexSessionFile(file)).toEqual([]);
		expect(parseCodexSessionFile(file, new Set())).toEqual([]);
	});

	it("only counts calls matching a known skill", () => {
		const file = writeSession([
			fnCall("firecrawl_search"),
			fnCall("get_goal"),
			fnCall("hatch-pet"),
		]);
		const out = parseCodexSessionFile(file, new Set(["hatch-pet"]));
		expect(out.map((i) => i.skillName)).toEqual(["hatch-pet"]);
		expect(out[0]?.agent).toBe("codex");
	});

	it("always counts skills read via SKILL.md path in exec_command", () => {
		const file = writeSession([
			fnCall(
				"exec_command",
				JSON.stringify({
					command: "cat /Users/x/.claude/skills/my-skill/SKILL.md",
				}),
			),
		]);
		const out = parseCodexSessionFile(file);
		expect(out.map((i) => i.skillName)).toEqual(["my-skill"]);
	});

	it("filters codex internal tools even if present in knownSkills", () => {
		const file = writeSession([fnCall("wait"), fnCall("update_plan")]);
		expect(
			parseCodexSessionFile(file, new Set(["wait", "update_plan"])),
		).toEqual([]);
	});
});
