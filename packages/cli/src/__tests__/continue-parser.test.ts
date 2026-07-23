import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseContinueSessionFile } from "../scanner/connectors/continue";

function writeSession(session: object): string {
	const dir = mkdtempSync(join(tmpdir(), "skillkit-continue-"));
	const file = join(dir, "abc-123.json");
	writeFileSync(file, JSON.stringify(session));
	return file;
}

function skillsToolItem(skillName: string, callId = "call_1") {
	return {
		message: {
			role: "assistant",
			content: "",
			toolCalls: [
				{
					id: callId,
					type: "function",
					function: {
						name: "Skills",
						arguments: JSON.stringify({ skill_name: skillName }),
					},
				},
			],
		},
		contextItems: [],
		toolCallStates: [
			{
				toolCallId: callId,
				toolCall: {
					id: callId,
					type: "function",
					function: {
						name: "Skills",
						arguments: JSON.stringify({ skill_name: skillName }),
					},
				},
				status: "done",
				parsedArgs: { skill_name: skillName },
			},
		],
	};
}

describe("parseContinueSessionFile", () => {
	it("extracts skills invoked via the built-in Skills tool", () => {
		const file = writeSession({
			sessionId: "abc-123",
			title: "Test session",
			workspaceDirectory: "/tmp",
			history: [skillsToolItem("hatch-pet")],
		});
		const out = parseContinueSessionFile(file);
		expect(out.map((i) => i.skillName)).toEqual(["hatch-pet"]);
		expect(out[0]?.agent).toBe("continue");
		expect(out[0]?.sessionId).toBe("continue:abc-123");
	});

	it("dedupes the same tool call across toolCalls and toolCallStates", () => {
		const file = writeSession({
			sessionId: "abc-123",
			history: [skillsToolItem("hatch-pet", "call_x")],
		});
		expect(parseContinueSessionFile(file)).toHaveLength(1);
	});

	it("extracts skills read via SKILL.md path in tool arguments", () => {
		const file = writeSession({
			sessionId: "abc-123",
			history: [
				{
					message: {
						role: "assistant",
						content: "",
						toolCalls: [
							{
								id: "call_2",
								type: "function",
								function: {
									name: "Read",
									arguments: JSON.stringify({
										filepath: "/Users/x/.continue/skills/my-skill/SKILL.md",
									}),
								},
							},
						],
					},
					contextItems: [],
				},
			],
		});
		const out = parseContinueSessionFile(file);
		expect(out.map((i) => i.skillName)).toEqual(["my-skill"]);
	});

	it("counts non-internal tool names only when in knownSkills", () => {
		const file = writeSession({
			sessionId: "abc-123",
			history: [
				{
					message: {
						role: "assistant",
						content: "",
						toolCalls: [
							{
								id: "call_3",
								type: "function",
								function: { name: "my-mcp-skill", arguments: "{}" },
							},
							{
								id: "call_4",
								type: "function",
								function: { name: "other-tool", arguments: "{}" },
							},
						],
					},
					contextItems: [],
				},
			],
		});
		expect(parseContinueSessionFile(file)).toEqual([]);
		const out = parseContinueSessionFile(file, new Set(["my-mcp-skill"]));
		expect(out.map((i) => i.skillName)).toEqual(["my-mcp-skill"]);
	});

	it("ignores internal Continue tools even when in knownSkills", () => {
		const file = writeSession({
			sessionId: "abc-123",
			history: [
				{
					message: {
						role: "assistant",
						content: "",
						toolCalls: [
							{
								id: "call_5",
								type: "function",
								function: { name: "Bash", arguments: "{}" },
							},
						],
					},
					contextItems: [],
				},
			],
		});
		expect(parseContinueSessionFile(file, new Set(["Bash"]))).toEqual([]);
	});

	it("uses timestampOverride when provided", () => {
		const file = writeSession({
			sessionId: "abc-123",
			history: [skillsToolItem("hatch-pet")],
		});
		const out = parseContinueSessionFile(
			file,
			new Set(),
			"2026-07-18T00:00:00.000Z",
		);
		expect(out[0]?.timestamp).toBe("2026-07-18T00:00:00.000Z");
	});

	it("returns empty on missing file", () => {
		expect(parseContinueSessionFile("/nonexistent/nope.json")).toEqual([]);
	});

	it("returns empty on corrupt JSON", () => {
		const dir = mkdtempSync(join(tmpdir(), "skillkit-continue-"));
		const file = join(dir, "bad.json");
		writeFileSync(file, "{not json");
		expect(parseContinueSessionFile(file)).toEqual([]);
	});

	it("returns empty when history is missing or malformed", () => {
		const file = writeSession({ sessionId: "abc-123", history: "nope" });
		expect(parseContinueSessionFile(file)).toEqual([]);
		const file2 = writeSession({ sessionId: "abc-123" });
		expect(parseContinueSessionFile(file2)).toEqual([]);
	});

	it("tolerates malformed history items and tool calls", () => {
		const file = writeSession({
			sessionId: "abc-123",
			history: [
				null,
				42,
				{ message: null },
				{
					message: {
						role: "assistant",
						toolCalls: [null, {}, { function: {} }],
					},
				},
				{ toolCallStates: [null, {}, { toolCall: {} }] },
				skillsToolItem("hatch-pet"),
			],
		});
		const out = parseContinueSessionFile(file);
		expect(out.map((i) => i.skillName)).toEqual(["hatch-pet"]);
	});
});
