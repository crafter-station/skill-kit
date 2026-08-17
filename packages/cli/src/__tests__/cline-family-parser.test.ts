import { describe, expect, it } from "bun:test";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	listClineFamilyTaskFiles,
	parseClineFamilyApiHistory,
	parseClineFamilyUiMessages,
} from "../scanner/connectors/cline-family";

const fixturesDir = join(import.meta.dir, "fixtures");
const clineUiPath = join(fixturesDir, "cline-task", "ui_messages.json");
const clineApiPath = join(
	fixturesDir,
	"cline-task",
	"api_conversation_history.json",
);

function writeMessages(messages: unknown[]): string {
	const dir = mkdtempSync(join(tmpdir(), "skillkit-cline-family-"));
	const file = join(dir, "ui_messages.json");
	writeFileSync(file, JSON.stringify(messages));
	return file;
}

describe("parseClineFamilyUiMessages", () => {
	it("extracts useSkill tool invocations from ui messages", () => {
		const out = parseClineFamilyUiMessages(
			clineUiPath,
			"cline",
			"cline:1753142400000",
		);
		expect(out.map((i) => i.skillName)).toContain("resend");
		expect(out[0]?.agent).toBe("cline");
		expect(out[0]?.sessionId).toBe("cline:1753142400000");
	});

	it("returns zero when messages have no skill usage", () => {
		const file = writeMessages([
			{ ts: 1, type: "say", say: "text", text: "hello" },
			{
				ts: 2,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "execute_command", command: "ls" }),
			},
		]);
		expect(parseClineFamilyUiMessages(file, "cline", "cline:x")).toEqual([]);
	});

	it("filters by knownSkills when provided", () => {
		const out = parseClineFamilyUiMessages(
			clineUiPath,
			"cline",
			"cline:x",
			new Set(["resend"]),
		);
		const names = out.map((i) => i.skillName);
		expect(names).toContain("resend");
		expect(names).not.toContain("deslop");
	});

	it("returns [] for missing files, corrupt JSON, and non-arrays", () => {
		expect(
			parseClineFamilyUiMessages("/nonexistent/ui.json", "cline", "cline:x"),
		).toEqual([]);

		const dir = mkdtempSync(join(tmpdir(), "skillkit-cline-family-"));
		const corrupt = join(dir, "bad.json");
		writeFileSync(corrupt, "{not json");
		expect(parseClineFamilyUiMessages(corrupt, "cline", "cline:x")).toEqual([]);

		const notArray = join(fixturesDir, "kilo-part-skill.json");
		expect(parseClineFamilyUiMessages(notArray, "cline", "cline:x")).toEqual(
			[],
		);
	});
});

describe("parseClineFamilyApiHistory", () => {
	it("extracts native use_skill tool_use blocks", () => {
		const out = parseClineFamilyApiHistory(clineApiPath, "cline", "cline:api");
		expect(out.map((i) => i.skillName)).toContain("deslop");
	});

	it("dedupes repeated identical signals within one file", () => {
		const out = parseClineFamilyApiHistory(
			clineApiPath,
			"cline",
			"cline:dedupe",
			new Set(["resend", "deslop", "tiktok", "x-momentum"]),
			"2026-07-22T00:00:00.000Z",
		);
		expect(out.filter((i) => i.skillName === "resend")).toHaveLength(1);
	});
});

describe("listClineFamilyTaskFiles", () => {
	it("lists only the ui file when a task has both ui and api files", () => {
		const base = mkdtempSync(join(tmpdir(), "cline-family-"));
		try {
			const taskDir = join(base, "tasks", "1753142400000");
			mkdirSync(taskDir, { recursive: true });
			copyFileSync(clineUiPath, join(taskDir, "ui_messages.json"));
			copyFileSync(
				clineApiPath,
				join(taskDir, "api_conversation_history.json"),
			);
			const files = listClineFamilyTaskFiles([base]);
			expect(files).toHaveLength(1);
			expect(files[0]?.kind).toBe("ui");
		} finally {
			rmSync(base, { recursive: true, force: true });
		}
	});
});
