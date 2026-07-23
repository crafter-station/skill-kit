import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCopilotSessionFile } from "../scanner/connectors/copilot";

// Fixture events captured verbatim from a real GitHub Copilot CLI 1.0.73
// session at ~/.copilot/session-state/<uuid>/events.jsonl (2026-07-23).
function writeSession(lines: object[]): string {
	const dir = mkdtempSync(join(tmpdir(), "skillkit-copilot-"));
	const sessionDir = join(dir, "e77f2eab-37f7-4f9b-bf19-2a51191ea7d1");
	mkdirSync(sessionDir);
	const file = join(sessionDir, "events.jsonl");
	writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n"));
	return file;
}

function skillInvoked(name: string, timestamp = "2026-07-23T05:02:12.885Z") {
	return {
		type: "skill.invoked",
		data: {
			name,
			path: `/Users/x/.copilot/skills/${name}/SKILL.md`,
			content: `# ${name}\n`,
			source: "personal-copilot",
			description: "probe",
			trigger: "agent-invoked",
			model: "gpt-5-mini",
		},
		id: "17a31e99-3881-4efb-bae0-b669f08ac57b",
		timestamp,
		parentId: "30094324-19d3-46e5-8463-5d603457db23",
	};
}

function toolStart(
	toolName: string,
	args: Record<string, unknown>,
	timestamp = "2026-07-23T05:02:12.868Z",
) {
	return {
		type: "tool.execution_start",
		data: {
			toolCallId: "call_3htUzU7ulUPAf8oy4dGE4a32",
			toolName,
			arguments: args,
			model: "gpt-5-mini",
			turnId: "0",
		},
		id: "0aefb667-3205-4298-ad23-0605919895f7",
		timestamp,
		parentId: "213f6083-e02c-4af7-a63e-feaea8aee824",
	};
}

describe("parseCopilotSessionFile", () => {
	it("counts skill.invoked events without needing knownSkills", () => {
		const file = writeSession([skillInvoked("skillkit-probe")]);
		const out = parseCopilotSessionFile(file);
		expect(out.map((i) => i.skillName)).toEqual(["skillkit-probe"]);
		expect(out[0]?.agent).toBe("copilot");
		expect(out[0]?.sessionId).toBe(
			"copilot:e77f2eab-37f7-4f9b-bf19-2a51191ea7d1",
		);
		expect(out[0]?.timestamp).toBe("2026-07-23T05:02:12.885Z");
	});

	it("dedupes the skill tool call against its skill.invoked event", () => {
		const file = writeSession([
			toolStart("skill", { skill: "skillkit-probe" }),
			skillInvoked("skillkit-probe"),
		]);
		const out = parseCopilotSessionFile(file);
		expect(out.map((i) => i.skillName)).toEqual(["skillkit-probe"]);
	});

	it("counts skill tool calls even when skill.invoked never fires", () => {
		const file = writeSession([toolStart("skill", { skill: "lost-skill" })]);
		const out = parseCopilotSessionFile(file);
		expect(out.map((i) => i.skillName)).toEqual(["lost-skill"]);
	});

	it("extracts skills read via SKILL.md path in bash arguments", () => {
		const file = writeSession([
			toolStart("bash", {
				command: "cat /Users/x/.copilot/skills/my-skill/SKILL.md",
				description: "Read skill",
			}),
		]);
		const out = parseCopilotSessionFile(file);
		expect(out.map((i) => i.skillName)).toEqual(["my-skill"]);
	});

	it("ignores internal tools and unknown tools when knownSkills is empty", () => {
		const file = writeSession([
			toolStart("bash", { command: "echo hi" }),
			toolStart("str_replace_editor", { command: "view", path: "/tmp/a" }),
			toolStart("some-mcp-tool", { q: "x" }),
		]);
		expect(parseCopilotSessionFile(file)).toEqual([]);
	});

	it("counts non-internal tool names present in knownSkills", () => {
		const file = writeSession([
			toolStart("hatch-pet", { egg: "blue" }),
			toolStart("bash", { command: "ls" }),
		]);
		const out = parseCopilotSessionFile(file, new Set(["hatch-pet", "bash"]));
		expect(out.map((i) => i.skillName)).toEqual(["hatch-pet"]);
	});

	it("tolerates corrupt lines and missing data", () => {
		const dir = mkdtempSync(join(tmpdir(), "skillkit-copilot-"));
		const sessionDir = join(dir, "corrupt-session");
		mkdirSync(sessionDir);
		const file = join(sessionDir, "events.jsonl");
		writeFileSync(
			file,
			[
				"not json",
				"{}",
				'{"type":"skill.invoked"}',
				JSON.stringify(skillInvoked("ok-skill")),
			].join("\n"),
		);
		const out = parseCopilotSessionFile(file);
		expect(out.map((i) => i.skillName)).toEqual(["ok-skill"]);
	});

	it("returns empty for a missing file", () => {
		expect(parseCopilotSessionFile("/nonexistent/events.jsonl")).toEqual([]);
	});
});
