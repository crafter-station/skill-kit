import type { CoverageResult, FileUsage } from "./scanner";
import { bold, cyan, dim, green, red, yellow } from "../tui/colors";

export function renderCoverageReport(result: CoverageResult): string {
	const lines: string[] = [];
	lines.push("");
	lines.push(`  ${bold("COVERAGE")} ${dim("—")} ${cyan(result.skill.skillPath)}`);
	lines.push("");

	lines.push(`  SKILL.md            ${bold(String(result.skill.totalLines))} lines`);
	lines.push(`  Active estimate:    ${bold(String(result.activeLines))} lines ${dim(`(${result.utilizationPct.toFixed(0)}%)`)}`);
	if (result.deadLines > 0) {
		lines.push(`  Dead weight:        ${yellow(String(result.deadLines))} lines`);
	}
	lines.push(`  Traces analyzed:    ${dim(String(result.tracesAnalyzed))}`);

	if (result.referenceUsage.length > 0) {
		lines.push("");
		lines.push(`  ${bold(`REFERENCES (${result.referenceUsage.length} files)`)}`);
		lines.push(`  ${"─".repeat(50)}`);
		renderFileList(lines, result.referenceUsage);
	}

	if (result.scriptUsage.length > 0) {
		lines.push("");
		lines.push(`  ${bold(`SCRIPTS (${result.scriptUsage.length} files)`)}`);
		lines.push(`  ${"─".repeat(50)}`);
		renderFileList(lines, result.scriptUsage);
	}

	const deadRefs = result.referenceUsage.filter((u) => !u.isActive);
	const deadScripts = result.scriptUsage.filter((u) => !u.isActive);
	const totalDead = deadRefs.length + deadScripts.length;

	if (totalDead > 0) {
		const deadFileLines = [...deadRefs, ...deadScripts].reduce(
			(sum, u) => sum + u.file.lineCount,
			0,
		);
		lines.push("");
		lines.push(
			`  ${bold("RECOMMENDATION")}: Remove ${totalDead} unused file${totalDead > 1 ? "s" : ""} ${dim(`→ save ~${deadFileLines} lines of dead weight`)}`,
		);
	}

	lines.push("");
	return lines.join("\n");
}

function renderFileList(lines: string[], usage: FileUsage[]): void {
	for (const u of usage) {
		const icon = u.isActive ? green("✅") : red("❌");
		const count = u.totalTraces > 0
			? dim(`read in ${u.traceCount}/${u.totalTraces} traces`)
			: u.file.referencedInSkill
				? dim("referenced in SKILL.md")
				: red("never read");
		lines.push(`  ${icon} ${u.file.relativePath.padEnd(35)} ${count}`);
	}
}

export function renderCoverageJson(result: CoverageResult): string {
	return JSON.stringify(
		{
			skill_path: result.skill.skillPath,
			skill_name: result.skill.name,
			total_lines: result.skill.totalLines,
			active_lines: result.activeLines,
			dead_lines: result.deadLines,
			utilization_pct: result.utilizationPct,
			traces_analyzed: result.tracesAnalyzed,
			sections: result.skill.sections.map((s) => ({
				heading: s.heading,
				line_count: s.lineCount,
			})),
			references: result.referenceUsage.map((u) => ({
				path: u.file.relativePath,
				active: u.isActive,
				read_count: u.readCount,
				trace_count: u.traceCount,
				line_count: u.file.lineCount,
			})),
			scripts: result.scriptUsage.map((u) => ({
				path: u.file.relativePath,
				active: u.isActive,
				read_count: u.readCount,
				trace_count: u.traceCount,
				line_count: u.file.lineCount,
			})),
		},
		null,
		2,
	);
}
