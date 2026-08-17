import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	parseKiloPartData,
	parseKiloTaskFile,
} from "../scanner/connectors/kilocode";

const fixturesDir = join(import.meta.dir, "fixtures");
const rooUiPath = join(fixturesDir, "roo-task", "ui_messages.json");
const kiloPartRaw = readFileSync(
	join(fixturesDir, "kilo-part-skill.json"),
	"utf-8",
);

describe("parseKiloPartData", () => {
	it("extracts a skill tool part with expected Invocation fields", () => {
		const out = parseKiloPartData("ses_4b7e2d", 1753150000000, kiloPartRaw);
		expect(out).toHaveLength(1);
		expect(out[0]?.skillName).toBe("resend");
		expect(out[0]?.agent).toBe("kilocode");
		expect(out[0]?.sessionId).toBe("kilo:ses_4b7e2d");
		expect(out[0]?.timestamp).toBe(new Date(1753150000000).toISOString());
		expect(out[0]?.eventId).toBe("call_abc123");
	});

	it("returns zero when the part is not a skill tool", () => {
		const bash = JSON.stringify({
			type: "tool",
			tool: "bash",
			state: { status: "completed", input: { command: "ls" } },
		});
		expect(parseKiloPartData("s", 1, bash)).toEqual([]);
	});

	it("filters by knownSkills when the set is non-empty", () => {
		expect(parseKiloPartData("s", 1, kiloPartRaw, new Set(["other"]))).toEqual(
			[],
		);
		expect(
			parseKiloPartData("s", 1, kiloPartRaw, new Set(["resend"])),
		).toHaveLength(1);
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

describe("parseKiloTaskFile (legacy Cline-family dirs)", () => {
	it("parses legacy ui_messages.json with the kilo session prefix", () => {
		const out = parseKiloTaskFile(rooUiPath, "1753146000000");
		expect(out.length).toBeGreaterThan(0);
		expect(out[0]?.agent).toBe("kilocode");
		expect(out[0]?.sessionId).toBe("kilo:1753146000000");
		expect(out.map((i) => i.skillName)).toContain("resend");
	});

	it("returns [] for a missing file", () => {
		expect(parseKiloTaskFile(join(fixturesDir, "nope.json"), "1")).toEqual([]);
	});
});
