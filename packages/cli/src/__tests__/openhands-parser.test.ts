import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseOpenHandsEventFile } from "../scanner/connectors/openhands";

// Fixture shapes match the OpenHands SDK event serialization
// (openhands-sdk event/base.py + llm_convertible/{action,message}.py,
// verified against tests/sdk/conversation/goal/fixtures/events.jsonl in
// OpenHands/software-agent-sdk). CLI layout per openhands-cli locations.py:
// ~/.openhands/conversations/<cid>/events/event-NNNNN-<event_id>.json
function writeEvent(event: object, layout: "cli" | "app" = "cli"): string {
	const dir = mkdtempSync(join(tmpdir(), "skillkit-openhands-"));
	if (layout === "cli") {
		const eventsDir = join(dir, "conversations", "conv-123", "events");
		mkdirSync(eventsDir, { recursive: true });
		const file = join(eventsDir, "event-00004-e54cbba2.json");
		writeFileSync(file, JSON.stringify(event, null, 2));
		return file;
	}
	const convDir = join(dir, "v1_conversations", "abcdef0123456789");
	mkdirSync(convDir, { recursive: true });
	const file = join(convDir, "e54cbba23be24494aa1383af6044c5a7.json");
	writeFileSync(file, JSON.stringify(event, null, 2));
	return file;
}

function actionEvent(toolName: string, argumentsJson: string) {
	return {
		id: "e54cbba2-3be2-4494-aa13-83af6044c5a7",
		timestamp: "2026-06-16T05:39:48.701247",
		source: "agent",
		thought: [{ cache_prompt: false, type: "text", text: "thinking" }],
		reasoning_content: null,
		thinking_blocks: [],
		responses_reasoning_item: null,
		action: { command: "echo hi", is_input: false, kind: "TerminalAction" },
		tool_name: toolName,
		tool_call_id: "chatcmpl-tool-9d0341c7a033ae28",
		tool_call: {
			id: "chatcmpl-tool-9d0341c7a033ae28",
			responses_item_id: null,
			name: toolName,
			arguments: argumentsJson,
			origin: "completion",
		},
		llm_response_id: "0680149d625114e6a97f54b158714212",
		security_risk: "UNKNOWN",
		critic_result: null,
		summary: null,
		kind: "ActionEvent",
	};
}

function messageEvent(activatedSkills: string[]) {
	return {
		id: "1eb65bb3-22e7-473f-855c-2dcf26ae8e08",
		timestamp: "2026-06-16T05:40:00.385957",
		source: "user",
		llm_message: {
			role: "user",
			content: [{ cache_prompt: false, type: "text", text: "hello" }],
		},
		activated_skills: activatedSkills,
		kind: "MessageEvent",
	};
}

describe("parseOpenHandsEventFile", () => {
	it("counts activated_skills on MessageEvent without needing knownSkills", () => {
		const file = writeEvent(messageEvent(["code-review", "github-pr-review"]));
		const out = parseOpenHandsEventFile(file);
		expect(out.map((i) => i.skillName)).toEqual([
			"code-review",
			"github-pr-review",
		]);
		expect(out[0]?.agent).toBe("openhands");
		expect(out[0]?.sessionId).toBe("openhands:conv-123");
		expect(out[0]?.timestamp).toBe("2026-06-16T05:40:00.385957");
	});

	it("derives sessionId from the app-server v1_conversations layout", () => {
		const file = writeEvent(messageEvent(["code-review"]), "app");
		const out = parseOpenHandsEventFile(file);
		expect(out[0]?.sessionId).toBe("openhands:abcdef0123456789");
	});

	it("extracts skills read via SKILL.md path in tool_call arguments", () => {
		const file = writeEvent(
			actionEvent(
				"terminal",
				JSON.stringify({
					command: "cat /home/user/.openhands/skills/my-skill/SKILL.md",
				}),
			),
		);
		const out = parseOpenHandsEventFile(file);
		expect(out.map((i) => i.skillName)).toEqual(["my-skill"]);
	});

	it("ignores internal tools even when present in knownSkills", () => {
		const file = writeEvent(
			actionEvent("terminal", JSON.stringify({ command: "echo hi" })),
		);
		expect(parseOpenHandsEventFile(file, new Set(["terminal"]))).toEqual([]);
	});

	it("counts non-internal tool names present in knownSkills", () => {
		const file = writeEvent(
			actionEvent("hatch-pet", JSON.stringify({ egg: "blue" })),
		);
		const out = parseOpenHandsEventFile(file, new Set(["hatch-pet"]));
		expect(out.map((i) => i.skillName)).toEqual(["hatch-pet"]);
	});

	it("ignores unknown tool names when knownSkills is empty", () => {
		const file = writeEvent(
			actionEvent("hatch-pet", JSON.stringify({ egg: "blue" })),
		);
		expect(parseOpenHandsEventFile(file)).toEqual([]);
	});

	it("tolerates corrupt or non-event JSON files", () => {
		const dir = mkdtempSync(join(tmpdir(), "skillkit-openhands-"));
		const eventsDir = join(dir, "conversations", "conv-x", "events");
		mkdirSync(eventsDir, { recursive: true });

		const corrupt = join(eventsDir, "event-00000-bad.json");
		writeFileSync(corrupt, "not json");
		expect(parseOpenHandsEventFile(corrupt)).toEqual([]);

		const noKind = join(eventsDir, "event-00001-nokind.json");
		writeFileSync(noKind, JSON.stringify({ foo: "bar" }));
		expect(parseOpenHandsEventFile(noKind)).toEqual([]);
	});

	it("returns empty for a missing file", () => {
		expect(parseOpenHandsEventFile("/nonexistent/event-00000-x.json")).toEqual(
			[],
		);
	});
});
