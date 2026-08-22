import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { parseRooTaskFile } from "../scanner/connectors/roo";

const fixturesDir = join(import.meta.dir, "fixtures");
const rooUiPath = join(fixturesDir, "roo-task", "ui_messages.json");
const rooApiPath = join(
	fixturesDir,
	"roo-task",
	"api_conversation_history.json",
);

describe("parseRooTaskFile", () => {
	it("extracts skill tool asks with expected Invocation fields", () => {
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

	it("returns only non-skill noise when filtered to an empty known set match", () => {
		const out = parseRooTaskFile(rooUiPath, "t1", new Set(["no-such-skill"]));
		expect(out).toEqual([]);
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

	it("extracts XML/native skill signals from api history", () => {
		const out = parseRooTaskFile(
			rooApiPath,
			"t1",
			new Set(["resend", "deslop"]),
		);
		const names = out.map((i) => i.skillName);
		expect(names).toContain("resend");
		expect(names).toContain("deslop");
	});

	it("returns [] for a missing file or corrupt JSON", () => {
		expect(parseRooTaskFile(join(fixturesDir, "nope.json"), "t1")).toEqual([]);
		expect(
			parseRooTaskFile(join(fixturesDir, "kilo-part-skill.json"), "t1"),
		).toEqual([]);
	});
});
