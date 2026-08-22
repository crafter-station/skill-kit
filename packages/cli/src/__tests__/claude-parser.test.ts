import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseSessionFile } from "../scanner/connectors/claude";

function writeSession(lines: object[], name = "sess-abc.jsonl"): string {
	const dir = mkdtempSync(join(tmpdir(), "skillkit-claude-"));
	const file = join(dir, name);
	writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n"));
	return file;
}

function skillToolUse(
	skill: string,
	id = "toolu_01abc",
	timestamp = "2026-07-18T00:00:00.000Z",
) {
	return {
		type: "assistant",
		timestamp,
		message: {
			content: [
				{
					type: "tool_use",
					id,
					name: "Skill",
					input: { skill },
				},
			],
		},
	};
}

function userCommand(name: string, timestamp = "2026-07-18T00:00:00.000Z") {
	return {
		type: "user",
		timestamp,
		message: {
			content: `<command-name>/${name}</command-name>`,
		},
	};
}

describe("parseSessionFile (claude)", () => {
	it("extracts Skill tool_use with skillName, agent, sessionId, eventId", () => {
		const file = writeSession([skillToolUse("hatch-pet")]);
		const out = parseSessionFile(file);
		expect(out).toHaveLength(1);
		expect(out[0]?.skillName).toBe("hatch-pet");
		expect(out[0]?.agent).toBe("claude");
		expect(out[0]?.sessionId).toBe("sess-abc");
		expect(out[0]?.timestamp).toBe("2026-07-18T00:00:00.000Z");
		expect(out[0]?.eventId).toBe("toolu_01abc");
	});

	it("returns zero invocations when there is no skill usage", () => {
		const file = writeSession([
			{
				type: "assistant",
				timestamp: "2026-07-18T00:00:00.000Z",
				message: {
					content: [{ type: "text", text: "hello" }],
				},
			},
			{
				type: "assistant",
				timestamp: "2026-07-18T00:00:00.000Z",
				message: {
					content: [
						{
							type: "tool_use",
							name: "Bash",
							input: { command: "ls" },
						},
					],
				},
			},
		]);
		expect(parseSessionFile(file)).toEqual([]);
	});

	it("filters slash commands by knownSkills", () => {
		const file = writeSession([
			userCommand("hatch-pet"),
			userCommand("other-cmd"),
		]);
		expect(parseSessionFile(file)).toEqual([]);
		const out = parseSessionFile(file, new Set(["hatch-pet"]));
		expect(out.map((i) => i.skillName)).toEqual(["hatch-pet"]);
	});

	it("returns empty on missing file, corrupt lines, and malformed entries", () => {
		expect(parseSessionFile("/nonexistent/sess.jsonl")).toEqual([]);

		const dir = mkdtempSync(join(tmpdir(), "skillkit-claude-"));
		const corrupt = join(dir, "bad.jsonl");
		writeFileSync(
			corrupt,
			[
				"{not json",
				JSON.stringify(null),
				JSON.stringify({ type: "assistant", message: { content: "x" } }),
				JSON.stringify(skillToolUse("survivor")),
			].join("\n"),
		);
		const out = parseSessionFile(corrupt);
		expect(out.map((i) => i.skillName)).toEqual(["survivor"]);
	});
});
