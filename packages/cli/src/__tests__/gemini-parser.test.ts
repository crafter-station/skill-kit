import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseGeminiSessionFile } from "../scanner/connectors/gemini";

function writeSession(session: object, name = "session-abc.json"): string {
	const dir = mkdtempSync(join(tmpdir(), "skillkit-gemini-"));
	const file = join(dir, name);
	writeFileSync(file, JSON.stringify(session));
	return file;
}

describe("parseGeminiSessionFile", () => {
	it("extracts toolCalls matching knownSkills", () => {
		const file = writeSession({
			sessionId: "abc",
			startTime: "2026-07-18T00:00:00.000Z",
			messages: [
				{
					timestamp: "2026-07-18T01:00:00.000Z",
					toolCalls: [{ name: "hatch-pet", args: {} }],
				},
			],
		});
		expect(parseGeminiSessionFile(file)).toEqual([]);
		const out = parseGeminiSessionFile(file, new Set(["hatch-pet"]));
		expect(out).toHaveLength(1);
		expect(out[0]?.skillName).toBe("hatch-pet");
		expect(out[0]?.agent).toBe("gemini");
		expect(out[0]?.sessionId).toBe("gemini:session-abc");
		expect(out[0]?.timestamp).toBe("2026-07-18T01:00:00.000Z");
	});

	it("extracts skill:name mentions from model content when known", () => {
		const file = writeSession({
			sessionId: "abc",
			startTime: "2026-07-18T00:00:00.000Z",
			messages: [
				{
					type: "model",
					content: "I'll use skill:deslop next.",
				},
			],
		});
		expect(parseGeminiSessionFile(file, new Set(["other"]))).toEqual([]);
		const out = parseGeminiSessionFile(file, new Set(["deslop"]));
		expect(out.map((i) => i.skillName)).toEqual(["deslop"]);
	});

	it("returns zero invocations when there is no skill usage", () => {
		const file = writeSession({
			sessionId: "abc",
			messages: [
				{ type: "user", content: "hello" },
				{
					type: "model",
					content: "no skill markers here",
					toolCalls: [{ name: "run_shell", args: { cmd: "ls" } }],
				},
			],
		});
		expect(parseGeminiSessionFile(file, new Set(["hatch-pet"]))).toEqual([]);
	});

	it("filters functionCalls by knownSkills (only known names recorded)", () => {
		const file = writeSession({
			sessionId: "abc",
			messages: [
				{
					functionCalls: [{ name: "hatch-pet" }, { name: "unknown-tool" }],
				},
			],
		});
		const out = parseGeminiSessionFile(file, new Set(["hatch-pet"]));
		expect(out.map((i) => i.skillName)).toEqual(["hatch-pet"]);
	});

	it("returns empty on missing file, corrupt JSON, and malformed sessions", () => {
		expect(parseGeminiSessionFile("/nonexistent/session-x.json")).toEqual([]);

		const dir = mkdtempSync(join(tmpdir(), "skillkit-gemini-"));
		const corrupt = join(dir, "session-bad.json");
		writeFileSync(corrupt, "{not json");
		expect(parseGeminiSessionFile(corrupt, new Set(["x"]))).toEqual([]);

		expect(
			parseGeminiSessionFile(
				writeSession({ sessionId: "x", messages: "bad" }),
				new Set(["x"]),
			),
		).toEqual([]);
	});
});
