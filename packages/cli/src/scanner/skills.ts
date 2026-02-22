import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { InstalledSkill } from "../types";

interface AgentDef {
	agent: string;
	id: string;
	dirs: string[];
}

function getSupportedAgents(): AgentDef[] {
	const os = platform();
	const home = homedir();

	const agents: AgentDef[] = [
		{ agent: "Claude Code", id: "claude", dirs: [join(home, ".claude", "skills")] },
	];

	if (os === "win32") {
		const localAppData = process.env.LOCALAPPDATA || join(home, "AppData", "Local");
		agents.push({
			agent: "OpenCode",
			id: "opencode",
			dirs: [
				join(localAppData, "opencode", "skills"),
				join(home, ".config", "opencode", "skills"),
			],
		});
	} else {
		const xdgData = process.env.XDG_DATA_HOME || join(home, ".local", "share");
		agents.push({
			agent: "OpenCode",
			id: "opencode",
			dirs: [
				join(xdgData, "opencode", "skills"),
				join(home, ".config", "opencode", "skills"),
			],
		});
	}

	return agents;
}

function parseYamlFrontmatter(content: string): Record<string, string> {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match || !match[1]) return {};
	const result: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const value = line
			.slice(colonIdx + 1)
			.trim()
			.replace(/^["']|["']$/g, "");
		if (key) result[key] = value;
	}
	return result;
}

function getDirSize(dirPath: string): number {
	let total = 0;
	try {
		const entries = readdirSync(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(dirPath, entry.name);
			if (entry.isDirectory()) {
				total += getDirSize(fullPath);
			} else {
				try {
					total += statSync(fullPath).size;
				} catch {}
			}
		}
	} catch {}
	return total;
}

function scanSkillsDir(skillsDir: string, agent: string): InstalledSkill[] {
	if (!existsSync(skillsDir)) return [];

	const skills: InstalledSkill[] = [];
	let entries: string[];
	try {
		entries = readdirSync(skillsDir);
	} catch {
		return skills;
	}

	for (const entry of entries) {
		const skillPath = join(skillsDir, entry);
		let stat: ReturnType<typeof statSync>;
		try {
			stat = statSync(skillPath);
		} catch {
			continue;
		}
		if (!stat.isDirectory()) continue;

		const skillMdPath = join(skillPath, "SKILL.md");
		let description = "";
		let name = entry;

		if (existsSync(skillMdPath)) {
			try {
				const content = readFileSync(skillMdPath, "utf-8");
				const frontmatter = parseYamlFrontmatter(content);
				if (frontmatter.name) name = frontmatter.name;
				if (frontmatter.description) description = frontmatter.description;
				if (!description) {
					const lines = content
						.replace(/^---[\s\S]*?---\n/, "")
						.trim()
						.split("\n");
					for (const line of lines) {
						const cleaned = line.replace(/^#+\s*/, "").trim();
						if (cleaned && !cleaned.startsWith("---")) {
							description = cleaned;
							break;
						}
					}
				}
			} catch {}
		}

		const size = getDirSize(skillPath);

		skills.push({
			name,
			path: skillPath,
			description,
			size,
			installedAt: new Date(stat.birthtime).toISOString(),
			agent,
		});
	}

	return skills;
}

export function scanInstalledSkills(agentFilter?: string): InstalledSkill[] {
	const allSkills: InstalledSkill[] = [];
	const seen = new Set<string>();
	const agents = getSupportedAgents();

	for (const { agent, id, dirs } of agents) {
		if (agentFilter && id !== agentFilter) continue;
		for (const dir of dirs) {
			const skills = scanSkillsDir(dir, agent);
			if (skills.length === 0) continue;
			for (const skill of skills) {
				try {
					const ino = statSync(skill.path).ino;
					const key = `${ino}`;
					if (seen.has(key)) continue;
					seen.add(key);
				} catch {}
				allSkills.push(skill);
			}
			break;
		}
	}

	return allSkills.sort((a, b) => a.name.localeCompare(b.name));
}

export function getDetectedAgents(agentFilter?: string): string[] {
	const detected: string[] = [];
	for (const { agent, id, dirs } of getSupportedAgents()) {
		if (agentFilter && id !== agentFilter) continue;
		for (const dir of dirs) {
			if (existsSync(dir)) {
				detected.push(agent);
				break;
			}
		}
	}
	return detected;
}
