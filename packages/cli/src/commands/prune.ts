import {
	existsSync,
	lstatSync,
	readdirSync,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getTopSkills } from "../db/queries";
import { getDb } from "../db/schema";
import { scanInstalledSkills } from "../scanner/skills";
import { bold, cyan, dim, red, yellow } from "../tui/colors";

const HOME = homedir();
const LOCK_PATH = join(HOME, ".agents", ".skill-lock.json");

const AGENT_SKILL_DIRS = [
	join(HOME, ".claude", "skills"),
	join(HOME, ".cursor", "skills"),
	join(HOME, ".codex", "skills"),
	join(HOME, ".codeium", "windsurf", "skills"),
	join(HOME, ".config", "amp", "skills"),
	join(HOME, ".config", "opencode", "skills"),
	join(HOME, ".copilot", "skills"),
	join(HOME, ".pi", "agent", "skills"),
	join(HOME, ".gemini", "antigravity", "skills"),
];

function removeFromLockFile(skillName: string): void {
	if (!existsSync(LOCK_PATH)) return;
	try {
		const data = JSON.parse(readFileSync(LOCK_PATH, "utf-8"));
		if (data.skills && data.skills[skillName]) {
			delete data.skills[skillName];
			writeFileSync(LOCK_PATH, JSON.stringify(data, null, 2) + "\n", "utf-8");
		}
	} catch {
		/* empty */
	}
}

function removeSymlinks(skillName: string): number {
	let cleaned = 0;
	for (const agentDir of AGENT_SKILL_DIRS) {
		const linkPath = join(agentDir, skillName);
		if (!existsSync(linkPath)) continue;
		try {
			const stat = lstatSync(linkPath);
			if (stat.isSymbolicLink()) {
				unlinkSync(linkPath);
				cleaned++;
			}
		} catch {
			/* empty */
		}
	}
	return cleaned;
}

function isRegistrySkill(skillName: string): boolean {
	if (!existsSync(LOCK_PATH)) return false;
	try {
		const data = JSON.parse(readFileSync(LOCK_PATH, "utf-8"));
		return !!(data.skills && data.skills[skillName]);
	} catch {
		/* empty */
	}
	return false;
}

function removeSkillClean(name: string, path: string): boolean {
	try {
		const isRegistry = isRegistrySkill(name);
		if (isRegistry) {
			removeSymlinks(name);
			removeFromLockFile(name);
		}
		rmSync(path, { recursive: true, force: true });
		if (isRegistry) {
			const canonicalPath = join(HOME, ".agents", "skills", name);
			if (existsSync(canonicalPath) && canonicalPath !== path) {
				rmSync(canonicalPath, { recursive: true, force: true });
			}
		}
		return true;
	} catch {
		/* empty */
	}
	return false;
}

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
	const pluginManaged = skills.filter(
		(s) => s.source && !usedNames.has(s.name),
	);
	const unused = skills.filter((s) => !s.source && !usedNames.has(s.name));

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
			} catch {
				/* empty */
			}
		}
		totalWaste += chars;
		candidates.push({ name: skill.name, path: skill.path, chars });
	}

	console.log(
		`\n  ${bold("PRUNE")} ${dim("— unused skills in the last 30 days")}\n`,
	);

	for (const c of candidates) {
		const registry = isRegistrySkill(c.name) ? dim(" (registry)") : "";
		const size = c.chars > 0 ? dim(` (${(c.chars / 1000).toFixed(1)}K)`) : "";
		console.log(`  ${red("×")} ${c.name}${size}${registry}`);
	}

	console.log(
		`\n  ${bold(String(candidates.length))} skills ${dim("·")} ${bold(`${(totalWaste / 1000).toFixed(1)}K`)} ${dim("context reclaimable")}`,
	);

	if (pluginManaged.length > 0) {
		console.log(
			`  ${dim(`${pluginManaged.length} unused plugin-bundled skills skipped (managed via /plugin, would be restored on update)`)}`,
		);
	}

	const args = process.argv.slice(3);

	const skillFlag = args.indexOf("--skill");
	const targetSkill = skillFlag >= 0 ? args[skillFlag + 1] : undefined;

	const targets = targetSkill
		? candidates.filter((c) => c.name === targetSkill)
		: candidates;

	if (targetSkill && targets.length === 0) {
		console.log(
			`\n  ${dim(`Skill "${targetSkill}" is not in the prune list (either used recently or not installed).`)}\n`,
		);
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
		if (removeSkillClean(c.name, c.path)) {
			removed++;
			removedNames.push(c.name);
		} else if (!isJson) {
			console.log(`  ${yellow("!")} Failed to remove ${c.name}`);
		}
	}

	if (isJson) {
		console.log(
			JSON.stringify({
				removed: removedNames,
				count: removed,
				reclaimed_chars: totalWaste,
			}),
		);
	} else {
		console.log(
			`\n  ${bold(`Removed ${removed} skills`)} ${dim("·")} ${bold(`${(totalWaste / 1000).toFixed(1)}K`)} ${dim("reclaimed")}\n`,
		);
	}
}
