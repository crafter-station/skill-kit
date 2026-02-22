import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "../db/schema";
import { performScan } from "../scanner/auto-scan";
import { countAllSessions } from "../scanner/index";
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

	if (skills.length === 0) {
		console.log(dim("  No skills found.\n"));
		return;
	}

	let skillsShCount = 0;
	let manualCount = 0;

	for (const skill of skills) {
		const source = detectSource(skill.path);
		if (source === "skills.sh") skillsShCount++;
		else manualCount++;
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

	const result = await performScan(db, { includeCommands });

	const sessionCount = countAllSessions();
	const totalRow = db
		.query<{ count: number }, []>(
			"SELECT COUNT(*) as count FROM skill_invocations",
		)
		.get();
	const totalInvocations = totalRow?.count ?? 0;

	console.log(
		`  ${dim("Indexed")} ${bold(String(sessionCount))} ${dim("sessions")} ${cyan("·")} ${bold(totalInvocations.toLocaleString())} ${dim("invocations")}`,
	);

	if (result.invocationCount > 0) {
		console.log(dim(`  (${result.invocationCount} new)`));
	}

	console.log(
		`\n  ${dim("Ready. Run")} ${cyan("skillkit stats")} ${dim("to see usage.")}\n`,
	);
}
