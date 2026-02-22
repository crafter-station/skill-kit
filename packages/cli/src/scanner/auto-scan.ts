import type { Database } from "bun:sqlite";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { deduplicateInvocations, upsertInstalledSkill } from "../db/queries";
import { scanAllSessions } from "./index";
import { getDetectedAgents, scanInstalledSkills } from "./skills";

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

export async function performScan(
	db: Database,
	options: {
		includeCommands?: boolean;
		quiet?: boolean;
		agentFilter?: string;
	} = {},
): Promise<{ skillCount: number; invocationCount: number }> {
	const { includeCommands = false, quiet = false, agentFilter } = options;

	const agents = getDetectedAgents(agentFilter);
	if (agents.length === 0) {
		return { skillCount: 0, invocationCount: 0 };
	}

	const skills = scanInstalledSkills(agentFilter);

	for (const skill of skills) {
		const source = detectSource(skill.path);
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

	const localSkillsDir = join(process.cwd(), ".claude", "skills");
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

	deduplicateInvocations(db);

	const newInvocations = await scanAllSessions(db, knownSkills, agentFilter);

	return { skillCount: skills.length, invocationCount: newInvocations };
}
