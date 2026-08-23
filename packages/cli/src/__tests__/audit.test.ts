import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	auditSkill,
	auditSkills,
	discoverSkillDirectories,
	isStrictFailure,
} from "../audit/analyzer";
import { renderAuditJson } from "../audit/report";
import { parseAuditArgs } from "../commands/audit";

describe("skill audit", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "skillkit-audit-"));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	function makeSkill(
		folder: string,
		name: string,
		description: string,
		body = "# Instructions\n\nDo the work.",
	): string {
		const path = join(root, folder);
		mkdirSync(path, { recursive: true });
		writeFileSync(
			join(path, "SKILL.md"),
			`---\nname: ${name}\ndescription: "${description}"\n---\n\n${body}\n`,
		);
		return path;
	}

	it("discovers nested skill packs and filters by glob", () => {
		const first = makeSkill(
			"skills/mobile-testing",
			"rn-testing",
			"Test React Native changes",
		);
		makeSkill(
			"skills/expo-release",
			"expo-release",
			"Release Expo applications",
		);
		mkdirSync(join(root, "node_modules", "ignored"), { recursive: true });
		writeFileSync(join(root, "node_modules", "ignored", "SKILL.md"), "ignored");

		expect(discoverSkillDirectories([root])).toHaveLength(2);
		expect(discoverSkillDirectories([root], ["rn-*"])).toEqual([
			realpathSync(first),
		]);
		expect(discoverSkillDirectories([root], ["skills/expo-*"])).toHaveLength(1);
	});

	it("separates eager, activation and on-demand context", () => {
		const skillPath = makeSkill(
			"skills/healthy",
			"healthy",
			"Audit healthy skills when validating a pack",
			"# Workflow\n\nRead references/errors.md when validation fails.",
		);
		mkdirSync(join(skillPath, "references"));
		mkdirSync(join(skillPath, "scripts"));
		mkdirSync(join(skillPath, "assets"));
		writeFileSync(
			join(skillPath, "references", "errors.md"),
			"# Errors\n\nFix the input.\n",
		);
		writeFileSync(
			join(skillPath, "scripts", "check.ts"),
			"export const ok = true;\n",
		);
		writeFileSync(join(skillPath, "assets", "template.txt"), "template\n");

		const result = auditSkills({ paths: [root] });
		const skill = result.skills[0];

		expect(skill?.status).toBe("pass");
		expect(skill?.metrics.referenceFiles).toBe(1);
		expect(skill?.metrics.scriptFiles).toBe(1);
		expect(skill?.metrics.assetFiles).toBe(1);
		expect(result.summary.catalogTokens).toBeGreaterThan(0);
		expect(result.summary.activationTokens.max).toBeGreaterThan(0);
		expect(result.summary.onDemandReferenceTokens).toBeGreaterThan(0);
		expect(result.tokenEstimation.approximate).toBe(true);
	});

	it("finds missing, unreferenced and ungated references", () => {
		const skillPath = makeSkill(
			"skills/broken",
			"broken",
			"Audit a broken skill",
			"# References\n\nSee references/used.md and references/missing.md.",
		);
		mkdirSync(join(skillPath, "references"));
		writeFileSync(join(skillPath, "references", "used.md"), "used\n");
		writeFileSync(join(skillPath, "references", "orphan.md"), "orphan\n");

		const result = auditSkill(skillPath);
		const codes = result.findings.map((finding) => finding.code);

		expect(result.status).toBe("fail");
		expect(codes).toContain("missing_file");
		expect(codes).toContain("unreferenced_reference");
		expect(codes).toContain("ungated_reference");
	});

	it("rejects escaping pointers and flags oversized skill bodies", () => {
		const body = [
			"# Workflow",
			"",
			"Read references/../../../outside.md when validation fails.",
			...Array.from({ length: 501 }, () => "word ".repeat(40)),
		].join("\n");
		const skillPath = makeSkill(
			"skills/oversized",
			"oversized",
			"Audit a deliberately oversized skill",
			body,
		);
		mkdirSync(join(skillPath, "references"));

		const result = auditSkill(skillPath);
		const codes = result.findings.map((finding) => finding.code);

		expect(result.status).toBe("fail");
		expect(codes).toContain("unsafe_file_path");
		expect(codes).toContain("skill_too_many_lines");
		expect(codes).toContain("skill_too_many_tokens");
	});

	it("parses multiline descriptions", () => {
		const path = join(root, "multiline");
		mkdirSync(path);
		writeFileSync(
			join(path, "SKILL.md"),
			"---\nname: multiline\ndescription: >\n  Audit a skill pack\n  before publishing it\n---\n\n# Workflow\n\nRun checks.\n",
		);

		const result = auditSkill(path);
		expect(result.description).toBe("Audit a skill pack before publishing it");
		expect(result.findings.map((finding) => finding.code)).not.toContain(
			"missing_description",
		);
	});

	it("detects duplicate names and similar descriptions", () => {
		makeSkill(
			"one",
			"shared",
			"Audit React Native Expo release verification workflows and deployment checks",
		);
		makeSkill(
			"two",
			"shared",
			"Audit React Native Expo release verification workflows and deployment checks",
		);

		const result = auditSkills({ paths: [root] });
		expect(result.summary.status).toBe("fail");
		expect(result.overlaps[0]?.reason).toBe("duplicate_name");
		expect(isStrictFailure(result)).toBe(true);
	});

	it("emits stable machine-readable JSON", () => {
		makeSkill("skill", "json-skill", "Audit one skill as JSON");
		const result = auditSkills({ paths: [root] });
		const json = JSON.parse(renderAuditJson(result));

		expect(json.summary.total).toBe(1);
		expect(json.summary.catalog_tokens).toBeGreaterThan(0);
		expect(json.skills[0].metrics.estimated_tokens).toBeGreaterThan(0);
	});

	it("parses repeated include flags and strict mode", () => {
		expect(
			parseAuditArgs([
				"./skills",
				"--include",
				"rn-*",
				"--include=expo-*",
				"--json",
				"--strict",
			]),
		).toEqual({
			paths: ["./skills"],
			include: ["rn-*", "expo-*"],
			json: true,
			strict: true,
			help: false,
		});
		expect(() => parseAuditArgs(["--include"])).toThrow(
			"--include requires a glob",
		);
	});
});
