import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { InstalledSkill } from "../types";

const AGENT_SKILL_PATHS: Array<{ agent: string; dir: string }> = [
	{ agent: "Claude Code", dir: join(homedir(), ".claude", "skills") },
	{ agent: "Cursor", dir: join(homedir(), ".cursor", "skills") },
	{ agent: "Codex", dir: join(homedir(), ".codex", "skills") },
	{ agent: "Windsurf", dir: join(homedir(), ".codeium", "windsurf", "skills") },
	{ agent: "Gemini CLI", dir: join(homedir(), ".gemini", "skills") },
	{ agent: "Cline", dir: join(homedir(), ".cline", "skills") },
	{ agent: "Roo Code", dir: join(homedir(), ".roo", "skills") },
	{ agent: "Continue", dir: join(homedir(), ".continue", "skills") },
	{ agent: "OpenCode", dir: join(homedir(), ".config", "opencode", "skills") },
	{ agent: "GitHub Copilot", dir: join(homedir(), ".copilot", "skills") },
	{ agent: "OpenHands", dir: join(homedir(), ".openhands", "skills") },
	{ agent: "Amp", dir: join(homedir(), ".config", "agents", "skills") },
	{ agent: "Goose", dir: join(homedir(), ".config", "goose", "skills") },
	{ agent: "Kilo Code", dir: join(homedir(), ".kilocode", "skills") },
	{ agent: "Trae", dir: join(homedir(), ".trae", "skills") },
];

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

function scanSkillsDir(
	skillsDir: string,
	agent: string,
): InstalledSkill[] {
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

export function scanInstalledSkills(): InstalledSkill[] {
	const allSkills: InstalledSkill[] = [];
	const seen = new Set<string>();

	for (const { agent, dir } of AGENT_SKILL_PATHS) {
		const skills = scanSkillsDir(dir, agent);
		for (const skill of skills) {
			try {
				const ino = statSync(skill.path).ino;
				const key = `${ino}`;
				if (seen.has(key)) continue;
				seen.add(key);
			} catch {}
			allSkills.push(skill);
		}
	}

	return allSkills.sort((a, b) => a.name.localeCompare(b.name));
}

export function getDetectedAgents(): string[] {
	const agents: string[] = [];
	for (const { agent, dir } of AGENT_SKILL_PATHS) {
		if (existsSync(dir)) agents.push(agent);
	}
	return agents;
}
