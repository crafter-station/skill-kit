import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getTopSkills } from "../db/queries";
import { getDb } from "../db/schema";
import { scanInstalledSkills } from "../scanner/skills";
import { bold, dim, green, yellow } from "../tui/colors";
import { healthGauge } from "../tui/health";

const CONTEXT_BUDGET = 16000;

function check(label: string) {
	return `  ${green("✓")} ${label}`;
}

function warn(label: string) {
	return `  ${yellow("⚠")} ${label}`;
}

function info(label: string) {
	return `  ${dim("●")} ${label}`;
}

function _formatSize(bytes: number): string {
	if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${bytes} B`;
}

export async function runHealth(): Promise<void> {
	const skills = scanInstalledSkills();
	const _skillsDir = join(homedir(), ".claude", "skills");
	const dbPath = join(homedir(), ".skill-kit", "analytics.db");
	const dbExists = existsSync(dbPath);

	let totalContextChars = 0;
	for (const skill of skills) {
		const skillMdPath = join(skill.path, "SKILL.md");
		if (existsSync(skillMdPath)) {
			try {
				const content = readFileSync(skillMdPath, "utf-8");
				totalContextChars += content.length;
			} catch {}
		}
	}

	let eventCount = 0;
	let neverUsed: string[] = [];
	let hasDbData = false;

	if (dbExists) {
		const db = getDb();
		const row = db
			.query<{ count: number }, []>(
				"SELECT COUNT(*) as count FROM skill_invocations",
			)
			.get();
		eventCount = row?.count ?? 0;
		hasDbData = eventCount > 0;

		if (hasDbData) {
			const topSkills = getTopSkills(db, 365);
			const usedNames = new Set(topSkills.map((s) => s.skill_name));
			neverUsed = skills
				.filter((s) => !usedNames.has(s.name))
				.map((s) => s.name);
		}
	}

	const contextPct = Math.min(
		100,
		Math.round((totalContextChars / CONTEXT_BUDGET) * 100),
	);
	const usedContextKb = (totalContextChars / 1000).toFixed(1);
	const budgetKb = (CONTEXT_BUDGET / 1000).toFixed(1);

	console.log(`\n  ${bold("SKILL-KIT HEALTH REPORT")}\n`);

	console.log(check(`${skills.length} skills installed`));

	if (dbExists && hasDbData) {
		console.log(
			check(`Analytics DB: ${eventCount.toLocaleString()} events tracked`),
		);
	} else if (dbExists) {
		console.log(warn("Analytics DB exists but has no data"));
		console.log(dim("    Run: skill-kit scan"));
	} else {
		console.log(warn("Analytics DB not found"));
		console.log(dim("    Run: skill-kit scan"));
	}

	if (neverUsed.length > 0) {
		console.log();
		console.log(warn(`${neverUsed.length} skills never used`));
		const preview = neverUsed.slice(0, 5).join(", ");
		const more = neverUsed.length > 5 ? ` +${neverUsed.length - 5} more` : "";
		console.log(`    ${dim(preview + more)}`);
		console.log(`    ${dim("Run: skill-kit uninstall <name>")}`);
	}

	const unusedContextChars = neverUsed.reduce((acc, name) => {
		const skill = skills.find((s) => s.name === name);
		if (!skill) return acc;
		const skillMdPath = join(skill.path, "SKILL.md");
		if (!existsSync(skillMdPath)) return acc;
		try {
			return acc + readFileSync(skillMdPath, "utf-8").length;
		} catch {
			return acc;
		}
	}, 0);

	console.log();
	const gaugeStr = healthGauge(100 - contextPct);
	console.log(
		info(
			`Context budget: ${contextPct}% consumed (${usedContextKb}K / ${budgetKb}K chars)`,
		),
	);
	console.log(`    ${gaugeStr}`);
	if (unusedContextChars > 0) {
		console.log(
			`    ${dim(`${neverUsed.length} unused skills waste ~${(unusedContextChars / 1000).toFixed(1)}K chars`)}`,
		);
	}

	console.log();
}
