import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	parseWindsurfAgentBlob,
	parseWindsurfChatData,
} from "../scanner/connectors/windsurf";

const fixturesDir = join(import.meta.dir, "fixtures");
const chatFixture = readFileSync(
	join(fixturesDir, "windsurf-chatdata.json"),
	"utf-8",
);
const agentFixture = readFileSync(
	join(fixturesDir, "windsurf-agentdata.json"),
	"utf-8",
);

describe("parseWindsurfChatData", () => {
	it("extracts skills read via SKILL.md path in bubble text and tool args", () => {
		const out = parseWindsurfChatData(chatFixture, new Set(["resend"]));
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((i) => i.skillName === "resend")).toBe(true);
		expect(out[0]?.agent).toBe("windsurf");
		expect(out[0]?.sessionId).toBe(
			"windsurf:chat:3f6a1c2e-11aa-4bb2-9c0d-77e5a9f01234",
		);
	});

	it("finds SKILL.md path reads even without knownSkills", () => {
		const out = parseWindsurfChatData(chatFixture);
		expect(out.map((i) => i.skillName)).toContain("resend");
	});

	it("uses the provided fallback timestamp", () => {
		const ts = "2026-07-01T12:00:00.000Z";
		const out = parseWindsurfChatData(chatFixture, new Set(), ts);
		expect(out[0]?.timestamp).toBe(ts);
	});

	it("derives a deterministic timestamp when none is provided (no re-record across scans)", () => {
		const a = parseWindsurfChatData(chatFixture);
		const b = parseWindsurfChatData(chatFixture);
		expect(a[0]?.timestamp).toBe(b[0]?.timestamp);
	});

	it("returns [] for corrupt JSON", () => {
		expect(parseWindsurfChatData("{not json", new Set(["resend"]))).toEqual([]);
	});

	it("returns [] for JSON without tabs", () => {
		expect(parseWindsurfChatData('{"foo":1}', new Set(["resend"]))).toEqual([]);
	});

	it("tolerates malformed tabs and bubbles", () => {
		const raw = JSON.stringify({
			tabs: [null, { bubbles: [null, 42, { text: 7 }] }, { bubbles: "x" }],
		});
		expect(parseWindsurfChatData(raw, new Set(["resend"]))).toEqual([]);
	});
});

describe("parseWindsurfAgentBlob", () => {
	it("extracts skill tool calls gated by knownSkills", () => {
		const out = parseWindsurfAgentBlob(
			"agentData:abc123",
			agentFixture,
			new Set(["skillkit", "hapi-cli"]),
		);
		const names = out.map((i) => i.skillName);
		expect(names).toContain("skillkit");
		expect(names).toContain("hapi-cli");
		expect(out[0]?.agent).toBe("windsurf");
		expect(out[0]?.sessionId).toBe("windsurf:agent:agentData:abc123");
	});

	it("ignores unknown tool names without a SKILL.md path", () => {
		const out = parseWindsurfAgentBlob("agentData:abc123", agentFixture);
		const names = out.map((i) => i.skillName);
		expect(names).not.toContain("skillkit");
		expect(names).toContain("hapi-cli");
	});

	it("uses createdAt as the timestamp (stable across scans, unlike lastUpdatedAt)", () => {
		const out = parseWindsurfAgentBlob(
			"agentData:abc123",
			agentFixture,
			new Set(["skillkit"]),
		);
		expect(out[0]?.timestamp).toBe(new Date(1752868800000).toISOString());
	});

	it("derives a deterministic synthetic timestamp when the blob has no dates", () => {
		const raw = JSON.stringify({
			conversation: [
				{
					toolCalls: [
						{ name: "shell", args: { cmd: "cat skills/hapi-cli/SKILL.md" } },
					],
				},
			],
		});
		const a = parseWindsurfAgentBlob("agentData:zzz", raw);
		const b = parseWindsurfAgentBlob("agentData:zzz", raw);
		expect(a[0]?.timestamp).toBe(b[0]?.timestamp);
	});

	it("returns [] for corrupt JSON", () => {
		expect(
			parseWindsurfAgentBlob("agentData:x", "garbage", new Set(["skillkit"])),
		).toEqual([]);
	});

	it("returns [] when conversation is missing", () => {
		expect(
			parseWindsurfAgentBlob(
				"agentData:x",
				'{"name":"no convo"}',
				new Set(["skillkit"]),
			),
		).toEqual([]);
	});

	it("tolerates malformed conversation steps", () => {
		const raw = JSON.stringify({
			conversation: [null, "str", { toolCalls: "x" }, { toolCall: null }],
		});
		expect(
			parseWindsurfAgentBlob("agentData:x", raw, new Set(["skillkit"])),
		).toEqual([]);
	});
});
