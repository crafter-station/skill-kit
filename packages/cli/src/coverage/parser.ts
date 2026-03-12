import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface SkillSection {
	heading: string;
	startLine: number;
	endLine: number;
	lineCount: number;
}

export interface ReferenceFile {
	path: string;
	relativePath: string;
	sizeBytes: number;
	lineCount: number;
	referencedInSkill: boolean;
}

export interface SkillStructure {
	skillPath: string;
	name: string;
	description: string;
	totalLines: number;
	totalChars: number;
	sections: SkillSection[];
	referenceFiles: ReferenceFile[];
	scriptFiles: ReferenceFile[];
	referencePointers: string[];
}

export function parseSkillDirectory(skillPath: string): SkillStructure {
	const skillMd = findSkillFile(skillPath);
	if (!skillMd) {
		throw new Error(`No SKILL.md found in ${skillPath}`);
	}

	const content = readFileSync(skillMd, "utf-8");
	const lines = content.split("\n");

	const { name, description } = extractFrontmatter(content);
	const sections = extractSections(lines);
	const referencePointers = extractReferencePointers(content);

	const referencesDir = join(skillPath, "references");
	const scriptsDir = join(skillPath, "scripts");

	const referenceFiles = scanDir(referencesDir, skillPath, referencePointers);
	const scriptFiles = scanDir(scriptsDir, skillPath, referencePointers);

	return {
		skillPath,
		name,
		description,
		totalLines: lines.length,
		totalChars: content.length,
		sections,
		referenceFiles,
		scriptFiles,
		referencePointers,
	};
}

function findSkillFile(dir: string): string | null {
	const candidates = ["SKILL.md", "skill.md"];
	for (const c of candidates) {
		const p = join(dir, c);
		if (existsSync(p)) return p;
	}

	if (existsSync(dir) && statSync(dir).isFile() && dir.endsWith(".md")) {
		return dir;
	}

	return null;
}

function extractFrontmatter(content: string): { name: string; description: string } {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match) return { name: "", description: "" };

	const yaml = match[1]!;
	const nameMatch = yaml.match(/^name:\s*(.+)$/m);
	const descMatch = yaml.match(/^description:\s*(.+)$/m);

	let name = nameMatch?.[1]?.trim() ?? "";
	let description = descMatch?.[1]?.trim() ?? "";

	if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);
	if (description.startsWith('"') && description.endsWith('"'))
		description = description.slice(1, -1);

	return { name, description };
}

function extractSections(lines: string[]): SkillSection[] {
	const sections: SkillSection[] = [];
	let currentHeading: string | null = null;
	let currentStart = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		if (line.match(/^#{1,4}\s+/)) {
			if (currentHeading !== null) {
				sections.push({
					heading: currentHeading,
					startLine: currentStart,
					endLine: i - 1,
					lineCount: i - currentStart,
				});
			}
			currentHeading = line.replace(/^#+\s+/, "").trim();
			currentStart = i;
		}
	}

	if (currentHeading !== null) {
		sections.push({
			heading: currentHeading,
			startLine: currentStart,
			endLine: lines.length - 1,
			lineCount: lines.length - currentStart,
		});
	}

	return sections;
}

function extractReferencePointers(content: string): string[] {
	const pointers: string[] = [];

	const fileRefs = content.match(/(?:references|scripts)\/[\w./-]+/g);
	if (fileRefs) {
		pointers.push(...fileRefs);
	}

	const codeBlocks = content.match(/`([^`]+\.(md|json|ts|js|py|sh))`/g);
	if (codeBlocks) {
		for (const cb of codeBlocks) {
			pointers.push(cb.replace(/`/g, ""));
		}
	}

	return [...new Set(pointers)];
}

function scanDir(
	dir: string,
	skillRoot: string,
	pointers: string[],
): ReferenceFile[] {
	if (!existsSync(dir)) return [];

	const files: ReferenceFile[] = [];
	try {
		const entries = readdirSync(dir, { recursive: true });
		for (const entry of entries) {
			const entryStr = typeof entry === "string" ? entry : entry.toString();
			const fullPath = join(dir, entryStr);
			try {
				const stat = statSync(fullPath);
				if (!stat.isFile()) continue;

				const rel = relative(skillRoot, fullPath);
				const content = readFileSync(fullPath, "utf-8");
				const lineCount = content.split("\n").length;

				const referencedInSkill = pointers.some(
					(p) => rel.includes(p) || p.includes(rel) || rel.endsWith(p.split("/").pop() ?? ""),
				);

				files.push({
					path: fullPath,
					relativePath: rel,
					sizeBytes: stat.size,
					lineCount,
					referencedInSkill,
				});
			} catch {}
		}
	} catch {}

	return files;
}
