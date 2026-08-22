import {
	existsSync,
	lstatSync,
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

/** Prefer HOME so tests can isolate; Bun caches os.homedir() at process start. */
function getHome(): string {
	return process.env.HOME || homedir();
}

function getLockPath(): string {
	return join(getHome(), ".agents", ".skill-lock.json");
}

function getAgentSkillDirs(): string[] {
	const home = getHome();
	return [
		join(home, ".claude", "skills"),
		join(home, ".cursor", "skills"),
		join(home, ".codex", "skills"),
		join(home, ".codeium", "windsurf", "skills"),
		join(home, ".config", "amp", "skills"),
		join(home, ".config", "opencode", "skills"),
		join(home, ".copilot", "skills"),
		join(home, ".pi", "agent", "skills"),
		join(home, ".gemini", "antigravity", "skills"),
	];
}

function readLockData(): { skills?: Record<string, unknown> } | null {
	const lockPath = getLockPath();
	if (!existsSync(lockPath)) return null;
	try {
		const parsed: unknown = JSON.parse(readFileSync(lockPath, "utf-8"));
		if (
			parsed === null ||
			typeof parsed !== "object" ||
			Array.isArray(parsed)
		) {
			return {};
		}
		return parsed as { skills?: Record<string, unknown> };
	} catch (error) {
		console.error(
			red(`Warning: could not read ${lockPath}: ${(error as Error).message}`),
		);
		return null;
	}
}

export function removeFromLockFile(skillName: string): void {
	const lockPath = getLockPath();
	const data = readLockData();
	if (data === null) return;
	if (data.skills?.[skillName]) {
		delete data.skills[skillName];
		writeFileSync(lockPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
	}
}

export function removeSymlinks(skillName: string): number {
	let cleaned = 0;
	for (const agentDir of getAgentSkillDirs()) {
		const linkPath = join(agentDir, skillName);
		try {
			const stat = lstatSync(linkPath);
			if (stat.isSymbolicLink()) {
				unlinkSync(linkPath);
				cleaned++;
			}
		} catch (error) {
			const err = error as NodeJS.ErrnoException;
			if (err.code === "ENOENT") continue;
			console.error(
				yellow(`Warning: could not remove symlink ${linkPath}: ${err.message}`),
			);
		}
	}
	return cleaned;
}

export function isRegistrySkill(skillName: string): boolean {
	const data = readLockData();
	if (data === null) return false;
	return !!data.skills?.[skillName];
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
			const canonicalPath = join(getHome(), ".agents", "skills", name);
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
