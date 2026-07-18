import type { Database } from "bun:sqlite";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { deduplicateInvocations, upsertInstalledSkill } from "../db/queries";
import type { InstalledSkill } from "../types";
import { isSkillName, scanAllSessions } from "./index";
import {
	detectSkillSource,
	getDetectedAgents,
	scanInstalledSkills,
} from "./skills";

export function buildKnownSkills(
	skills: InstalledSkill[],
	includeCommands: boolean,
): Set<string> {
	const knownSkills = new Set<string>();
	for (const skill of skills) {
		knownSkills.add(skill.name);
		knownSkills.add(basename(skill.path));
	}

	const localSkillsDir = join(process.cwd(), ".claude", "skills");
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
		for (const dir of commandDirs) {
			if (!existsSync(dir)) continue;
			try {
				for (const e of readdirSync(dir)) {
					if (e.endsWith(".md")) {
						knownSkills.add(e.slice(0, -3));
					} else {
						try {
							if (statSync(join(dir, e)).isDirectory()) {
								knownSkills.add(e);
							}
						} catch {}
					}
				}
			} catch {}
		}
	}

	return knownSkills;
}

export async function performScan(
	db: Database,
	options: {
		includeCommands?: boolean;
		quiet?: boolean;
		agentFilter?: string;
		force?: boolean;
	} = {},
): Promise<{ skillCount: number; invocationCount: number }> {
	const {
		includeCommands = false,
		quiet = false,
		agentFilter,
		force = false,
	} = options;

	const agents = getDetectedAgents(agentFilter);
	if (agents.length === 0) {
		return { skillCount: 0, invocationCount: 0 };
	}

	const skills = scanInstalledSkills(agentFilter);

	for (const skill of skills) {
		const source = detectSkillSource(skill);
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
		return { skillCount: 0, invocationCount: 0 };
	}

	const knownSkills = buildKnownSkills(skills, includeCommands);

	deduplicateInvocations(db);

	db.run(
		`DELETE FROM skill_invocations WHERE skill_name LIKE 'mcp__%' OR skill_name LIKE 'mcp_%'`,
	);
	const junkNames = [
		"Read",
		"Write",
		"Edit",
		"MultiEdit",
		"Bash",
		"Glob",
		"Grep",
		"WebSearch",
		"WebFetch",
		"TodoRead",
		"TodoWrite",
		"Task",
		"Agent",
		"Skill",
		"LSP",
		"NotebookEdit",
		"AskFollowupQuestion",
		"AttemptCompletion",
		"SearchReplace",
		"InsertCodeBlock",
		"ReadImages",
		"ExecuteCommand",
		"ListFiles",
		"SearchFiles",
		"ReadFile",
		"WriteFile",
		"ReplaceInFile",
		"ListCodeDefinitionNames",
		"BrowserAction",
		"UseMcp",
		"shell",
		"shell_command",
		"update_plan",
		"create_plan",
		"read_file",
		"write_file",
		"execute_command",
		"spawn_agent",
		"write_stdin",
		"multi_tool_use.parallel",
	];
	const placeholders = junkNames.map(() => "?").join(",");
	db.run(
		`DELETE FROM skill_invocations WHERE skill_name IN (${placeholders})`,
		junkNames,
	);

	const saltSkills = agentFilter ? scanInstalledSkills() : skills;
	const cacheSalt = Bun.hash(
		saltSkills
			.map((s) => s.name)
			.sort()
			.join("\n"),
	).toString(16);

	const newInvocations = await scanAllSessions(db, knownSkills, agentFilter, {
		force,
		quiet,
		cacheSalt,
	});

	if (!agentFilter) {
		const cleanupAllowlist = includeCommands
			? knownSkills
			: buildKnownSkills(skills, true);
		db.run(
			`DELETE FROM skill_invocations
				WHERE agent IN ('codex', 'cursor', 'gemini')
					AND skill_name NOT IN (SELECT name FROM installed_skills)
					AND skill_name NOT IN (SELECT value FROM json_each(?))`,
			[JSON.stringify([...cleanupAllowlist])],
		);
	}

	return { skillCount: skills.length, invocationCount: newInvocations };
}
