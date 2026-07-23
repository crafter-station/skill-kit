import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { InstalledSkill } from "../types";
import registry from "./agent-registry.generated.json" with { type: "json" };

interface AgentDef {
	agent: string;
	id: string;
	dirs: string[];
}

const LEGACY_IDS: Record<string, string> = {
	"claude-code": "claude",
	"gemini-cli": "gemini",
	kilo: "kilocode",
	"github-copilot": "copilot",
	"kiro-cli": "kiro",
};

function resolveRegistryDir(dir: string): string {
	const home = homedir();
	const xdgConfig = process.env.XDG_CONFIG_HOME || join(home, ".config");
	const codexHome = process.env.CODEX_HOME?.trim() || join(home, ".codex");
	const claudeHome =
		process.env.CLAUDE_CONFIG_DIR?.trim() || join(home, ".claude");
	if (dir.startsWith("~/")) return join(home, dir.slice(2));
	if (dir.startsWith("$XDG_CONFIG/"))
		return join(xdgConfig, dir.slice("$XDG_CONFIG/".length));
	if (dir.startsWith("$CODEX_HOME/"))
		return join(codexHome, dir.slice("$CODEX_HOME/".length));
	if (dir.startsWith("$CLAUDE_HOME/"))
		return join(claudeHome, dir.slice("$CLAUDE_HOME/".length));
	return dir;
}

function getSupportedAgents(): AgentDef[] {
	const home = homedir();
	const agents: AgentDef[] = [];
	const seenDirs = new Set<string>();
	const sharedDir = join(home, ".agents", "skills");

	for (const entry of registry.agents) {
		if (!entry.globalSkillsDir) continue;
		const dir = resolveRegistryDir(entry.globalSkillsDir);
		// Agents whose global dir IS the shared skills.sh dir are covered by
		// the single "shared" entry below; listing each would double-count.
		if (dir === sharedDir) continue;
		if (seenDirs.has(dir)) continue;
		seenDirs.add(dir);
		agents.push({
			agent: entry.displayName,
			id: LEGACY_IDS[entry.id] ?? entry.id,
			dirs: [dir],
		});
	}

	// OpenCode historically also used the XDG data dir; keep as fallback.
	const xdgData = process.env.XDG_DATA_HOME || join(home, ".local", "share");
	const opencode = agents.find((a) => a.id === "opencode");
	if (opencode) opencode.dirs.push(join(xdgData, "opencode", "skills"));

	if (existsSync(sharedDir)) {
		agents.push({
			agent: "skills.sh (shared)",
			id: "shared",
			dirs: [sharedDir],
		});
	}

	return agents;
}

interface PluginInstall {
	installPath?: string;
	version?: string;
}

interface PluginManifest {
	plugins?: Record<string, PluginInstall[]>;
}

function getClaudePluginSkillDirs(): Array<{ dir: string; source: string }> {
	const manifestPath = join(
		homedir(),
		".claude",
		"plugins",
		"installed_plugins.json",
	);
	if (!existsSync(manifestPath)) return [];

	let manifest: PluginManifest;
	try {
		manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
	} catch {
		return [];
	}

	const result: Array<{ dir: string; source: string }> = [];
	for (const [pluginKey, installs] of Object.entries(manifest.plugins ?? {})) {
		if (!Array.isArray(installs)) continue;
		for (const install of installs) {
			if (!install?.installPath) continue;
			const dir = join(install.installPath, "skills");
			if (existsSync(dir)) result.push({ dir, source: pluginKey });
		}
	}
	return result;
}

export function detectSkillSource(skill: InstalledSkill): string {
	if (skill.source) return skill.source;

	const metaDir = join(skill.path, ".skills");
	if (existsSync(metaDir)) return "skills.sh";

	const skillMd = join(skill.path, "SKILL.md");
	if (existsSync(skillMd)) {
		try {
			const entries = readdirSync(skill.path);
			if (entries.includes(".git") || entries.includes(".gitmodules"))
				return "skills.sh";
		} catch {}
	}
	return "manual";
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

	const addSkill = (skill: InstalledSkill): void => {
		try {
			const ino = statSync(skill.path).ino;
			if (seen.has(`ino:${ino}`)) return;
			seen.add(`ino:${ino}`);
		} catch {}
		if (seen.has(`name:${skill.name}`)) return;
		seen.add(`name:${skill.name}`);
		allSkills.push(skill);
	};

	for (const { agent, id, dirs } of agents) {
		if (agentFilter && id !== agentFilter) continue;
		for (const dir of dirs) {
			const skills = scanSkillsDir(dir, agent);
			if (skills.length === 0) continue;
			for (const skill of skills) {
				addSkill(skill);
			}
			break;
		}
	}

	if (!agentFilter || agentFilter === "claude") {
		for (const { dir, source } of getClaudePluginSkillDirs()) {
			for (const skill of scanSkillsDir(dir, "Claude Code")) {
				skill.source = source;
				addSkill(skill);
			}
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
