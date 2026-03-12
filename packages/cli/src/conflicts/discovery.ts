import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface DiscoveredSkill {
	name: string;
	description: string;
	path: string;
	scope: "global" | "project";
	keywords: string[];
}

const STOP_WORDS = new Set([
	"a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
	"have", "has", "had", "do", "does", "did", "will", "would", "shall",
	"should", "may", "might", "must", "can", "could", "to", "of", "in",
	"for", "on", "with", "at", "by", "from", "as", "into", "through",
	"and", "but", "or", "nor", "not", "so", "yet", "both", "either",
	"this", "that", "these", "those", "it", "its", "use", "when", "if",
]);

function extractKeywords(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, " ")
		.split(/\s+/)
		.filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function parseFrontmatter(
	content: string,
): { name: string; description: string } | null {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match) return null;

	const yaml = match[1]!;
	const nameMatch = yaml.match(/^name:\s*(.+)$/m);
	const descMatch = yaml.match(/^description:\s*(.+)$/m);

	if (!descMatch) return null;

	let description = descMatch[1]!.trim();
	if (description.startsWith('"') && description.endsWith('"')) {
		description = description.slice(1, -1);
	}
	if (description.startsWith("'") && description.endsWith("'")) {
		description = description.slice(1, -1);
	}

	if (description === "|" || description === ">") {
		const lines = yaml.split("\n");
		const descIdx = lines.findIndex((l) => l.match(/^description:/));
		if (descIdx !== -1) {
			const indented: string[] = [];
			for (let i = descIdx + 1; i < lines.length; i++) {
				if (lines[i]!.match(/^\s+/)) {
					indented.push(lines[i]!.trim());
				} else break;
			}
			description = indented.join(" ");
		}
	}

	let name = nameMatch?.[1]?.trim() ?? "";
	if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);
	if (name.startsWith("'") && name.endsWith("'")) name = name.slice(1, -1);

	return { name, description };
}

function scanSkillDir(dir: string, scope: "global" | "project"): DiscoveredSkill[] {
	const skills: DiscoveredSkill[] = [];

	if (!existsSync(dir)) return skills;

	try {
		const entries = readdirSync(dir);
		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const stat = statSync(fullPath);

			if (stat.isFile() && entry.endsWith(".md")) {
				const content = readFileSync(fullPath, "utf-8");
				const fm = parseFrontmatter(content);
				if (fm?.description) {
					skills.push({
						name: fm.name || entry.replace(/\.md$/, ""),
						description: fm.description,
						path: fullPath,
						scope,
						keywords: extractKeywords(fm.description),
					});
				}
			}

			if (stat.isDirectory()) {
				const skillMd = join(fullPath, "SKILL.md");
				if (existsSync(skillMd)) {
					const content = readFileSync(skillMd, "utf-8");
					const fm = parseFrontmatter(content);
					if (fm?.description) {
						skills.push({
							name: fm.name || entry,
							description: fm.description,
							path: skillMd,
							scope,
							keywords: extractKeywords(fm.description),
						});
					}
				}
			}
		}
	} catch {}

	return skills;
}

export function discoverAllSkills(projectRoot?: string): DiscoveredSkill[] {
	const skills: DiscoveredSkill[] = [];

	const globalSkillsDir = join(homedir(), ".claude", "skills");
	skills.push(...scanSkillDir(globalSkillsDir, "global"));

	const globalCommandsDir = join(homedir(), ".claude", "commands");
	skills.push(...scanSkillDir(globalCommandsDir, "global"));

	if (projectRoot) {
		const projectSkillsDir = join(projectRoot, ".claude", "skills");
		skills.push(...scanSkillDir(projectSkillsDir, "project"));

		const projectCommandsDir = join(projectRoot, ".claude", "commands");
		skills.push(...scanSkillDir(projectCommandsDir, "project"));
	}

	const seen = new Set<string>();
	return skills.filter((s) => {
		const key = `${s.name}:${s.path}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export function findOverlappingPairs(
	skills: DiscoveredSkill[],
	threshold = 0.3,
): Array<{ a: DiscoveredSkill; b: DiscoveredSkill; similarity: number }> {
	const pairs: Array<{ a: DiscoveredSkill; b: DiscoveredSkill; similarity: number }> = [];

	for (let i = 0; i < skills.length; i++) {
		for (let j = i + 1; j < skills.length; j++) {
			const a = skills[i]!;
			const b = skills[j]!;
			const setA = new Set(a.keywords);
			const setB = new Set(b.keywords);
			const intersection = new Set([...setA].filter((k) => setB.has(k)));
			const union = new Set([...setA, ...setB]);
			const jaccard = union.size > 0 ? intersection.size / union.size : 0;

			if (jaccard >= threshold) {
				pairs.push({ a, b, similarity: jaccard });
			}
		}
	}

	return pairs.sort((x, y) => y.similarity - x.similarity);
}
