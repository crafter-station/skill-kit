import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "../db/schema";
import { performScan } from "../scanner/auto-scan";
import { countAllSessions } from "../scanner/index";
import {
	detectSkillSource,
	getDetectedAgents,
	scanInstalledSkills,
} from "../scanner/skills";
import { parseAgentFilter } from "../tui/args";
import { bold, cyan, dim } from "../tui/colors";

export async function runScan(): Promise<void> {
	const args = process.argv.slice(3);
	const includeCommands = args.includes("--include-commands");
	const quiet = args.includes("--quiet");
	const agentFilter = parseAgentFilter(args);
	const db = getDb();

	const agents = getDetectedAgents(agentFilter);
	if (agents.length === 0) {
		if (!quiet)
			console.log(
				`\n  ${dim("No supported agents found (Claude Code, OpenCode).")}\n`,
			);
		return;
	}
	if (!quiet) console.log(`\n  ${dim(`Scanning ${agents.join(" + ")}`)}`);

	const skills = scanInstalledSkills(agentFilter);

	if (skills.length === 0) {
		if (!quiet) console.log(dim("  No skills found.\n"));
		return;
	}

	let skillsShCount = 0;
	let manualCount = 0;
	let pluginCount = 0;

	for (const skill of skills) {
		const source = detectSkillSource(skill);
		if (source === "skills.sh") skillsShCount++;
		else if (source === "manual") manualCount++;
		else pluginCount++;
	}

	const parts: string[] = [];
	if (skillsShCount > 0) parts.push(`${skillsShCount} via skills.sh`);
	if (pluginCount > 0) parts.push(`${pluginCount} via plugins`);
	if (manualCount > 0) parts.push(`${manualCount} manual`);

	if (!quiet)
		console.log(
			`  ${bold(`Found ${skills.length} skills`)} ${dim(`(${parts.join(", ")})`)}`,
		);

	const localSkillsDir = join(process.cwd(), ".claude", "skills");
	if (!quiet && existsSync(localSkillsDir)) {
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

	const result = await performScan(db, { includeCommands, agentFilter });

	const sessionCount = countAllSessions(agentFilter);
	const totalRow = db
		.query<{ count: number }, []>(
			"SELECT COUNT(*) as count FROM skill_invocations",
		)
		.get();
	const totalInvocations = totalRow?.count ?? 0;

	if (!quiet) {
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
}
