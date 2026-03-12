import type { ConflictSummary } from "./analyzer";
import { bold, cyan, dim, green, red, yellow } from "../tui/colors";

export function renderConflictReport(summary: ConflictSummary): string {
	const lines: string[] = [];
	lines.push("");
	lines.push(
		`  ${bold("CONFLICT ANALYSIS")} ${dim(`— ${summary.totalSkills} skills, ${summary.totalProbes} probes`)}`,
	);
	lines.push("");

	const cleanCount = summary.correct + summary.ambiguousCorrect.length;
	const problemCount = summary.wrongSkill.length + summary.noSkill.length;

	if (problemCount === 0) {
		lines.push(`  ${green("No collisions detected!")} ${dim(`${cleanCount}/${summary.totalProbes} probes matched correctly`)}`);
		lines.push("");
		return lines.join("\n");
	}

	if (summary.wrongSkill.length > 0) {
		lines.push(`  ${bold(red(`COLLISIONS (${summary.wrongSkill.length})`))}`);
		lines.push(`  ${"─".repeat(50)}`);

		for (const r of summary.wrongSkill) {
			lines.push(`  ${yellow(`"${r.probe.prompt}"`)}`);
			lines.push(`    Expected: ${cyan(r.probe.expectedSkill)}`);
			lines.push(`    Fired:    ${red(r.firedSkill ?? "(none)")}`);
			if (r.probe.pairSkills) {
				lines.push(`    Pair:     ${dim(r.probe.pairSkills.join(" vs "))}`);
			}
			lines.push("");
		}
	}

	if (summary.noSkill.length > 0) {
		lines.push(`  ${bold(yellow(`NO SKILL FIRED (${summary.noSkill.length})`))}`);
		lines.push(`  ${"─".repeat(50)}`);

		for (const r of summary.noSkill) {
			lines.push(`  ${dim(`"${r.probe.prompt}"`)}`);
			lines.push(`    Expected: ${cyan(r.probe.expectedSkill)}`);
			lines.push(`    Fired:    ${red("(none)")}`);
			lines.push("");
		}
	}

	lines.push(
		`  ${bold("SUMMARY")} ${green(`${cleanCount} correct`)} ${dim("|")} ${red(`${problemCount} problems`)} ${dim(`(${summary.totalProbes} total)`)}`,
	);
	lines.push("");

	return lines.join("\n");
}

export function renderConflictJson(summary: ConflictSummary): string {
	return JSON.stringify(
		{
			total_probes: summary.totalProbes,
			total_skills: summary.totalSkills,
			correct: summary.correct,
			ambiguous_correct: summary.ambiguousCorrect.length,
			collisions: summary.wrongSkill.map((r) => ({
				prompt: r.probe.prompt,
				expected: r.probe.expectedSkill,
				actual: r.firedSkill,
				pair: r.probe.pairSkills,
			})),
			no_skill: summary.noSkill.map((r) => ({
				prompt: r.probe.prompt,
				expected: r.probe.expectedSkill,
			})),
		},
		null,
		2,
	);
}
