import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { upsertInstalledSkill, deduplicateInvocations } from "../db/queries";
import { getDb } from "../db/schema";
import { countAllSessions, scanAllSessions } from "../scanner/index";
import { getDetectedAgents, scanInstalledSkills } from "../scanner/skills";
import { bold, cyan, dim } from "../tui/colors";

function detectSource(skillPath: string): "skills.sh" | "manual" {
	const metaDir = join(skillPath, ".skills");
	if (existsSync(metaDir)) return "skills.sh";

	const skillMd = join(skillPath, "SKILL.md");
	if (existsSync(skillMd)) {
		try {
			const entries = readdirSync(skillPath);
			if (entries.includes(".git") || entries.includes(".gitmodules"))
				return "skills.sh";
		} catch {}
	}
	return "manual";
}

export async function runScan(): Promise<void> {
	const includeCommands = process.argv.includes("--include-commands");
	const db = getDb();

	const agents = getDetectedAgents();
	if (agents.length === 0) {
		console.log(
			`\n  ${dim("No supported agents found (Claude Code, OpenCode).")}\n`,
		);
		return;
	}
	console.log(`\n  ${dim(`Scanning ${agents.join(" + ")}`)}`);

	const skills = scanInstalledSkills();

	let skillsShCount = 0;
	let manualCount = 0;

	for (const skill of skills) {
		const source = detectSource(skill.path);
		if (source === "skills.sh") skillsShCount++;
		else manualCount++;

		upsertInstalledSkill(
			db,
			skill.name,
			skill.path,
			source,
			undefined,
			skill.size,
		);
	}

	if (skills.length === 0) {
		console.log(dim("  No skills found.\n"));
		return;
	}

	const parts: string[] = [];
	if (skillsShCount > 0) parts.push(`${skillsShCount} via skills.sh`);
	if (manualCount > 0) parts.push(`${manualCount} manual`);

	console.log(
		`  ${bold(`Found ${skills.length} skills`)} ${dim(`(${parts.join(", ")})`)}`,
	);

	const localSkillsDir = join(process.cwd(), ".claude", "skills");
	if (existsSync(localSkillsDir)) {
		try {
			const localEntries = readdirSync(localSkillsDir).filter((e) => {
				try {
					return statSync(join(localSkillsDir, e)).isDirectory();
				} catch {
					return false;
				}
			});
			if (localEntries.length > 0) {
				console.log(
					dim(
						`  + ${localEntries.length} project-local skills in .claude/skills/`,
					),
				);
			}
		} catch {}
	}

	const knownSkills = new Set<string>();
	for (const skill of skills) {
		knownSkills.add(skill.name);
		knownSkills.add(basename(skill.path));
	}
	if (existsSync(localSkillsDir)) {
		try {
			for (const e of readdirSync(localSkillsDir)) {
				try {
					if (statSync(join(localSkillsDir, e)).isDirectory()) {
						knownSkills.add(e);
					}
				} catch {}
			}
		} catch {}
	}

	if (includeCommands) {
		const commandDirs = [
			join(process.cwd(), ".claude", "commands"),
			join(homedir(), ".claude", "commands"),
		];
		let commandCount = 0;
		for (const dir of commandDirs) {
			if (!existsSync(dir)) continue;
			try {
				for (const e of readdirSync(dir)) {
					if (e.endsWith(".md")) {
						knownSkills.add(e.slice(0, -3));
						commandCount++;
					} else {
						try {
							if (statSync(join(dir, e)).isDirectory()) {
								knownSkills.add(e);
								commandCount++;
							}
						} catch {}
					}
				}
			} catch {}
		}
		if (commandCount > 0) {
			console.log(dim(`  + ${commandCount} slash commands`));
		}
	}

	const removed = deduplicateInvocations(db);
	if (removed > 0) {
		console.log(`  ${dim(`Cleaned ${removed} duplicate entries`)}`);
	}

	console.log(dim("  Scanning sessions..."));

	const sessionCount = countAllSessions();
	const newInvocations = await scanAllSessions(db, knownSkills);
	const totalRow = db
		.query<{ count: number }, []>(
			"SELECT COUNT(*) as count FROM skill_invocations",
		)
		.get();
	const totalInvocations = totalRow?.count ?? 0;

	console.log(
		`  ${dim("Indexed")} ${bold(String(sessionCount))} ${dim("sessions")} ${cyan("·")} ${bold(totalInvocations.toLocaleString())} ${dim("invocations")}`,
	);

	if (newInvocations > 0) {
		console.log(dim(`  (${newInvocations} new)`));
	}

	console.log(
		`\n  ${dim("Ready. Run")} ${cyan("skillkit stats")} ${dim("to see usage.")}\n`,
	);
}
