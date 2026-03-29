import { existsSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getTopSkills } from "../db/queries";
import { getDb } from "../db/schema";
import { scanInstalledSkills } from "../scanner/skills";
import { bold, cyan, dim, red, yellow } from "../tui/colors";

export async function runPrune(): Promise<void> {
	const dbPath = join(homedir(), ".skillkit", "analytics.db");
	if (!existsSync(dbPath)) {
		console.log(`\n  ${yellow("No analytics data yet.")}`);
		console.log(`  ${dim("Run: skillkit scan")}\n`);
		return;
	}

	const db = getDb();
	const skills = scanInstalledSkills();

	if (skills.length === 0) {
		console.log(`\n  ${dim("No skills installed.")}\n`);
		return;
	}

	const topSkills = getTopSkills(db, 30);
	const usedNames = new Set(topSkills.map((s) => s.skill_name));
	const unused = skills.filter((s) => !usedNames.has(s.name));

	if (unused.length === 0) {
		console.log(
			`\n  ${dim("All")} ${bold(String(skills.length))} ${dim("skills were used in the last 30 days. Nothing to prune.")}\n`,
		);
		return;
	}

	let totalWaste = 0;
	const candidates: Array<{ name: string; path: string; chars: number }> = [];

	for (const skill of unused) {
		const skillMdPath = join(skill.path, "SKILL.md");
		let chars = 0;
		if (existsSync(skillMdPath)) {
			try {
				chars = readFileSync(skillMdPath, "utf-8").length;
			} catch {}
		}
		totalWaste += chars;
		candidates.push({ name: skill.name, path: skill.path, chars });
	}

	console.log(
		`\n  ${bold("PRUNE")} ${dim("— unused skills in the last 30 days")}\n`,
	);

	for (const c of candidates) {
		const size = c.chars > 0 ? dim(` (${(c.chars / 1000).toFixed(1)}K)`) : "";
		console.log(`  ${red("×")} ${c.name}${size}`);
	}

	console.log(
		`\n  ${bold(String(candidates.length))} skills ${dim("·")} ${bold(`${(totalWaste / 1000).toFixed(1)}K`)} ${dim("context reclaimable")}`,
	);

	const args = process.argv.slice(3);

	const skillFlag = args.indexOf("--skill");
	const targetSkill = skillFlag >= 0 ? args[skillFlag + 1] : undefined;

	const targets = targetSkill
		? candidates.filter((c) => c.name === targetSkill)
		: candidates;

	if (targetSkill && targets.length === 0) {
		console.log(`\n  ${dim(`Skill "${targetSkill}" is not in the prune list (either used recently or not installed).`)}\n`);
		return;
	}

	if (!args.includes("--yes") && !args.includes("-y")) {
		if (targetSkill) {
			console.log(`\n  ${dim("Will remove:")} ${bold(targetSkill)}`);
		}
		console.log(
			`\n  ${dim("Run with")} ${cyan("--yes")} ${dim("to confirm deletion.")}\n`,
		);
		return;
	}

	const isJson = args.includes("--json");
	let removed = 0;
	const removedNames: string[] = [];
	for (const c of targets) {
		try {
			rmSync(c.path, { recursive: true, force: true });
			removed++;
			removedNames.push(c.name);
		} catch { /* empty */
			if (!isJson) console.log(`  ${yellow("!")} Failed to remove ${c.name}`);
		}
	}

	if (isJson) {
		console.log(JSON.stringify({ removed: removedNames, count: removed, reclaimed_chars: totalWaste }));
	} else {
		console.log(
			`\n  ${bold(`Removed ${removed} skills`)} ${dim("·")} ${bold(`${(totalWaste / 1000).toFixed(1)}K`)} ${dim("reclaimed")}\n`,
		);
	}
}
