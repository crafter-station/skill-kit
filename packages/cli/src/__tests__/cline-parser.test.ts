import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseClineTaskFile } from "../scanner/connectors/cline";
import {
	parseClineFamilyApiHistory,
	parseClineFamilyUiMessages,
} from "../scanner/connectors/cline-family";
import {
	parseKiloPartData,
	parseKiloTaskFile,
} from "../scanner/connectors/kilocode";
import { parseRooTaskFile } from "../scanner/connectors/roo";

const fixturesDir = join(import.meta.dir, "fixtures");
const clineUiPath = join(fixturesDir, "cline-task", "ui_messages.json");
const clineApiPath = join(
	fixturesDir,
	"cline-task",
	"api_conversation_history.json",
);
const rooUiPath = join(fixturesDir, "roo-task", "ui_messages.json");
const rooApiPath = join(
	fixturesDir,
	"roo-task",
	"api_conversation_history.json",
);
const kiloPartRaw = readFileSync(
	join(fixturesDir, "kilo-part-skill.json"),
	"utf-8",
);

describe("cline: parseClineTaskFile (ui_messages.json)", () => {
	it("extracts useSkill tool invocations with the skill in path", () => {
		const out = parseClineTaskFile(clineUiPath, "1753142400000");
		const names = out.map((i) => i.skillName);
		expect(names).toContain("resend");
		expect(out[0]?.agent).toBe("cline");
		expect(out[0]?.sessionId).toBe("cline:1753142400000");
	});

	it("extracts skills read via SKILL.md path in readFile tool messages", () => {
		const out = parseClineTaskFile(clineUiPath, "1753142400000");
		expect(out.map((i) => i.skillName)).toContain("deslop");
	});

	it("uses the ClineMessage ts (ms epoch) as the timestamp", () => {
		const out = parseClineTaskFile(clineUiPath, "1753142400000");
		const resend = out.find((i) => i.skillName === "resend");
		expect(resend?.timestamp).toBe(new Date(1753142410000).toISOString());
	});

	it("filters by knownSkills when provided", () => {
		const out = parseClineTaskFile(
			clineUiPath,
			"1753142400000",
			new Set(["resend"]),
		);
		const names = out.map((i) => i.skillName);
		expect(names).toContain("resend");
		expect(names).not.toContain("some-other");
	});

	it("tolerates null entries, non-objects, and corrupt tool JSON", () => {
		expect(() =>
			parseClineTaskFile(clineUiPath, "1753142400000"),
		).not.toThrow();
	});

	it("returns [] for a missing file", () => {
		expect(parseClineTaskFile(join(fixturesDir, "nope.json"), "1")).toEqual([]);
	});
});

describe("cline: parseClineTaskFile (api_conversation_history.json)", () => {
	it("extracts XML use_skill calls from assistant text", () => {
		const out = parseClineTaskFile(clineApiPath, "1753142400000");
		expect(out.map((i) => i.skillName)).toContain("resend");
	});

	it("extracts native tool_use blocks named use_skill (input.skill_name)", () => {
		const out = parseClineTaskFile(clineApiPath, "1753142400000");
		expect(out.map((i) => i.skillName)).toContain("deslop");
	});

	it("extracts SKILL.md reads from tool_use input and plain string content", () => {
		const out = parseClineTaskFile(clineApiPath, "1753142400000");
		const names = out.map((i) => i.skillName);
		expect(names).toContain("tiktok");
		expect(names).toContain("x-momentum");
	});

	it("falls back to the numeric taskId timestamp when messages lack ts", () => {
		const out = parseClineTaskFile(clineApiPath, "1753142400000");
		expect(out[0]?.timestamp).toBe(new Date(1753142400000).toISOString());
	});

	it("filters tool_use skill names by knownSkills", () => {
		const out = parseClineTaskFile(
			clineApiPath,
			"1753142400000",
			new Set(["resend"]),
		);
		const names = out.map((i) => i.skillName);
		expect(names).toContain("resend");
		expect(names).not.toContain("deslop");
	});
});

describe("roo: parseRooTaskFile", () => {
	it("extracts skill tool asks with the name in the skill field", () => {
		const out = parseRooTaskFile(
			rooUiPath,
			"0198c2f4-aaaa-bbbb-cccc-000000000001",
		);
		const names = out.map((i) => i.skillName);
		expect(names).toContain("resend");
		expect(names).toContain("unknown-skill");
		expect(out[0]?.agent).toBe("roo");
		expect(out[0]?.sessionId).toBe("roo:0198c2f4-aaaa-bbbb-cccc-000000000001");
	});

	it("filters by knownSkills when provided", () => {
		const out = parseRooTaskFile(
			rooUiPath,
			"t1",
			new Set(["resend", "deslop"]),
		);
		const names = out.map((i) => i.skillName);
		expect(names).toContain("resend");
		expect(names).toContain("deslop");
		expect(names).not.toContain("unknown-skill");
	});

	it("uses message ts and falls back for messages without ts", () => {
		const fallback = "2026-07-22T00:00:00.000Z";
		const out = parseRooTaskFile(rooUiPath, "t1", new Set(), fallback);
		const resend = out.find((i) => i.skillName === "resend");
		const deslop = out.find((i) => i.skillName === "deslop");
		expect(resend?.timestamp).toBe(new Date(1753146010000).toISOString());
		expect(deslop?.timestamp).toBe(fallback);
	});

	it("extracts XML skill calls and native skill tool_use from api history", () => {
		const out = parseRooTaskFile(rooApiPath, "t1");
		const names = out.map((i) => i.skillName);
		expect(names).toContain("resend");
		expect(names).toContain("deslop");
	});

	it("uses per-message ts from Roo ApiMessage entries", () => {
		const out = parseRooTaskFile(rooApiPath, "t1");
		const resend = out.find((i) => i.skillName === "resend");
		expect(resend?.timestamp).toBe(new Date(1753146010000).toISOString());
	});

	it("returns [] for a missing file", () => {
		expect(parseRooTaskFile(join(fixturesDir, "nope.json"), "t1")).toEqual([]);
	});
});

describe("kilo: parseKiloTaskFile (legacy Cline-family dirs)", () => {
	it("parses legacy ui_messages.json with the kilo session prefix", () => {
		const out = parseKiloTaskFile(rooUiPath, "1753146000000");
		expect(out.length).toBeGreaterThan(0);
		expect(out[0]?.agent).toBe("kilocode");
		expect(out[0]?.sessionId).toBe("kilo:1753146000000");
	});
});

describe("kilo: parseKiloPartData (kilo.db part rows)", () => {
	it("extracts a skill tool part with input.name", () => {
		const out = parseKiloPartData("ses_4b7e2d", 1753150000000, kiloPartRaw);
		expect(out).toHaveLength(1);
		expect(out[0]?.skillName).toBe("resend");
		expect(out[0]?.agent).toBe("kilocode");
		expect(out[0]?.sessionId).toBe("kilo:ses_4b7e2d");
		expect(out[0]?.timestamp).toBe(new Date(1753150000000).toISOString());
	});

	it("filters by knownSkills", () => {
		expect(parseKiloPartData("s", 1, kiloPartRaw, new Set(["other"]))).toEqual(
			[],
		);
		expect(
			parseKiloPartData("s", 1, kiloPartRaw, new Set(["resend"])),
		).toHaveLength(1);
	});

	it("ignores non-skill tool parts", () => {
		const bash = JSON.stringify({
			type: "tool",
			tool: "bash",
			state: { status: "completed", input: { command: "ls" } },
		});
		expect(parseKiloPartData("s", 1, bash)).toEqual([]);
	});

	it("returns [] for corrupt JSON and malformed shapes", () => {
		expect(parseKiloPartData("s", 1, "{nope")).toEqual([]);
		expect(parseKiloPartData("s", 1, '{"type":"tool","tool":"skill"}')).toEqual(
			[],
		);
		expect(
			parseKiloPartData("s", 1, '{"type":"tool","tool":"skill","state":{}}'),
		).toEqual([]);
	});
});

describe("cline-family shared parser edge cases", () => {
	it("returns [] when the file is not a JSON array", () => {
		const notArray = join(fixturesDir, "kilo-part-skill.json");
		expect(parseClineFamilyUiMessages(notArray, "cline", "cline:x")).toEqual(
			[],
		);
		expect(parseClineFamilyApiHistory(notArray, "cline", "cline:x")).toEqual(
			[],
		);
	});

	it("dedupes repeated identical signals within one file", () => {
		const out = parseClineFamilyApiHistory(
			clineApiPath,
			"cline",
			"cline:dedupe",
			new Set(),
			"2026-07-22T00:00:00.000Z",
		);
		const resendHits = out.filter((i) => i.skillName === "resend");
		expect(resendHits).toHaveLength(1);
	});
});
