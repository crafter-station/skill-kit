import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCursorSessionFile } from "../scanner/connectors/cursor";

function writeSession(lines: object[], name = "cursor-sess.jsonl"): string {
	const dir = mkdtempSync(join(tmpdir(), "skillkit-cursor-"));
	const file = join(dir, name);
	writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n"));
	return file;
}

function skillToolUse(skill: string) {
	return {
		role: "assistant",
		message: {
			content: [
				{
					type: "tool_use",
					name: "Skill",
					input: { skill },
				},
			],
		},
	};
}

function userCommand(name: string) {
	return {
		role: "user",
		message: {
			content: `<command-name>/${name}</command-name>`,
		},
	};
}

describe("parseCursorSessionFile", () => {
	it("extracts Skill tool_use when the skill is in knownSkills", () => {
		const file = writeSession([skillToolUse("hatch-pet")]);
		expect(parseCursorSessionFile(file)).toEqual([]);
		const out = parseCursorSessionFile(file, new Set(["hatch-pet"]));
		expect(out).toHaveLength(1);
		expect(out[0]?.skillName).toBe("hatch-pet");
		expect(out[0]?.agent).toBe("cursor");
		expect(out[0]?.sessionId).toBe("cursor:cursor-sess");
		expect(typeof out[0]?.timestamp).toBe("string");
	});

	it("returns zero invocations when there is no skill usage", () => {
		const file = writeSession([
			{
				role: "assistant",
				message: {
					content: [
						{ type: "text", text: "hi" },
						{
							type: "tool_use",
							name: "Shell",
							input: { command: "ls" },
						},
					],
				},
			},
		]);
		expect(
			parseCursorSessionFile(file, new Set(["hatch-pet", "Shell"])),
		).toEqual([]);
	});

	it("filters slash commands by knownSkills", () => {
		const file = writeSession([
			userCommand("hatch-pet"),
			userCommand("other-cmd"),
		]);
		const out = parseCursorSessionFile(file, new Set(["hatch-pet"]));
		expect(out.map((i) => i.skillName)).toEqual(["hatch-pet"]);
	});

	it("returns empty on missing file, corrupt lines, and malformed entries", () => {
		expect(parseCursorSessionFile("/nonexistent/x.jsonl")).toEqual([]);

		const dir = mkdtempSync(join(tmpdir(), "skillkit-cursor-"));
		const corrupt = join(dir, "bad.jsonl");
		writeFileSync(
			corrupt,
			[
				"{not json",
				JSON.stringify({ role: "assistant" }),
				JSON.stringify({
					role: "assistant",
					message: { content: "not-array" },
				}),
				JSON.stringify(skillToolUse("survivor")),
			].join("\n"),
		);
		const out = parseCursorSessionFile(corrupt, new Set(["survivor"]));
		expect(out.map((i) => i.skillName)).toEqual(["survivor"]);
	});
});
