import {
	existsSync,
	readdirSync,
	readFileSync,
	realpathSync,
	statSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

const CHARS_PER_TOKEN = 3.7;
const SKILL_LINE_LIMIT = 500;
const SKILL_TOKEN_LIMIT = 5000;
const DESCRIPTION_CHAR_LIMIT = 1024;
const IGNORED_DIRECTORIES = new Set([
	".git",
	".next",
	".turbo",
	"build",
	"coverage",
	"dist",
	"node_modules",
]);
const ROUTING_WORDS = [
	"after",
	"antes",
	"before",
	"cuando",
	"después",
	"for",
	"if",
	"para",
	"si",
	"to",
	"when",
];
const ACTION_WORDS = [
	"abre",
	"carga",
	"check",
	"consulta",
	"consult",
	"ejecuta",
	"execute",
	"inspect",
	"lee",
	"load",
	"open",
	"read",
	"review",
	"revisa",
	"run",
	"usa",
	"use",
	"verifica",
	"verify",
];
const STOP_WORDS = new Set([
	"about",
	"after",
	"agent",
	"agents",
	"also",
	"and",
	"are",
	"con",
	"cuando",
	"del",
	"desde",
	"for",
	"from",
	"para",
	"por",
	"que",
	"skill",
	"skills",
	"the",
	"this",
	"use",
	"user",
	"using",
	"when",
	"with",
]);

export type AuditSeverity = "error" | "warning";
export type AuditStatus = "fail" | "warn" | "pass";
export type AuxiliaryKind = "reference" | "script" | "asset";

export interface AuditFinding {
	code: string;
	severity: AuditSeverity;
	message: string;
	path?: string;
}

export interface AuditFile {
	path: string;
	kind: AuxiliaryKind;
	bytes: number;
	lines: number | null;
	estimatedTokens: number | null;
	referenced: boolean;
	explicitInstruction: boolean | null;
}

export interface SkillAudit {
	name: string;
	description: string;
	path: string;
	skillFile: string;
	status: AuditStatus;
	metrics: {
		lines: number;
		chars: number;
		estimatedTokens: number;
		metadataTokens: number;
		referenceTokens: number;
		referenceFiles: number;
		scriptFiles: number;
		assetFiles: number;
	};
	files: AuditFile[];
	findings: AuditFinding[];
}

export interface SkillOverlap {
	skills: [string, string];
	similarity: number;
	severity: AuditSeverity;
	reason: "duplicate_name" | "similar_description";
}

export interface AuditResult {
	roots: string[];
	include: string[];
	tokenEstimation: {
		method: "chars_divided_by_3.7";
		approximate: true;
	};
	summary: {
		total: number;
		passed: number;
		warned: number;
		failed: number;
		status: AuditStatus;
		catalogTokens: number;
		activationTokens: {
			total: number;
			median: number;
			max: number;
		};
		onDemandReferenceTokens: number;
		referenceFiles: number;
		scriptFiles: number;
		assetFiles: number;
		findings: number;
	};
	overlaps: SkillOverlap[];
	skills: SkillAudit[];
}

interface Frontmatter {
	name: string;
	description: string;
	body: string;
}

interface PointerOccurrence {
	path: string;
	context: string;
}

export interface AuditOptions {
	paths: string[];
	include?: string[];
}

export function estimateTokens(chars: number): number {
	return Math.round(chars / CHARS_PER_TOKEN);
}

export function discoverSkillDirectories(
	paths: string[],
	include: string[] = [],
): string[] {
	const inputRoots =
		paths.length > 0 ? paths.map((path) => resolve(path)) : [process.cwd()];
	const roots = inputRoots.map((root) => realpathSync(root));
	const discovered = new Set<string>();

	for (const root of roots) {
		if (!existsSync(root)) throw new Error(`Path does not exist: ${root}`);
		const stat = statSync(root);
		if (stat.isFile()) {
			if (basename(root).toLowerCase() !== "skill.md") {
				throw new Error(`Expected a SKILL.md file: ${root}`);
			}
			discovered.add(realpathSync(dirname(root)));
			continue;
		}
		if (
			existsSync(join(root, "SKILL.md")) ||
			existsSync(join(root, "skill.md"))
		) {
			discovered.add(realpathSync(root));
			continue;
		}
		walkForSkills(root, discovered);
	}

	const filtered = [...discovered].filter((skillPath) => {
		if (include.length === 0) return true;
		const skillFile = existsSync(join(skillPath, "SKILL.md"))
			? join(skillPath, "SKILL.md")
			: join(skillPath, "skill.md");
		let declaredName = basename(skillPath);
		try {
			declaredName =
				parseFrontmatter(readFileSync(skillFile, "utf-8")).name || declaredName;
		} catch {}
		const candidates = [
			declaredName,
			basename(skillPath),
			...roots.map((root) => relative(root, skillPath).split(sep).join("/")),
		];
		return include.some((pattern) =>
			candidates.some((candidate) => globMatches(candidate, pattern)),
		);
	});

	return filtered.sort((a, b) => a.localeCompare(b));
}

function walkForSkills(root: string, discovered: Set<string>): void {
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
		if (IGNORED_DIRECTORIES.has(entry.name)) continue;
		const child = join(root, entry.name);
		if (
			existsSync(join(child, "SKILL.md")) ||
			existsSync(join(child, "skill.md"))
		) {
			discovered.add(realpathSync(child));
			continue;
		}
		walkForSkills(child, discovered);
	}
}

function globMatches(value: string, pattern: string): boolean {
	let source = "";
	for (let index = 0; index < pattern.length; index++) {
		const char = pattern[index];
		if (char === "*") {
			if (pattern[index + 1] === "*") {
				source += ".*";
				index++;
			} else {
				source += "[^/]*";
			}
		} else if (char === "?") {
			source += "[^/]";
		} else {
			source += char?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") ?? "";
		}
	}
	return new RegExp(`^${source}$`, "i").test(value);
}

export function auditSkill(skillPath: string): SkillAudit {
	const skillFile = existsSync(join(skillPath, "SKILL.md"))
		? join(skillPath, "SKILL.md")
		: join(skillPath, "skill.md");
	const content = readFileSync(skillFile, "utf-8");
	const frontmatter = parseFrontmatter(content);
	const name = frontmatter.name || basename(skillPath);
	const pointers = extractPointerOccurrences(frontmatter.body);
	const pointerPaths = new Set(
		pointers.map((pointer) => normalizePointer(pointer.path)),
	);
	const files = scanAuxiliaryFiles(skillPath, pointers, pointerPaths);
	const findings: AuditFinding[] = [];
	const lines = content.split("\n").length;
	const estimatedTokens = estimateTokens(content.length);

	if (!frontmatter.name) {
		findings.push({
			code: "missing_name",
			severity: "error",
			message: "Frontmatter is missing a name",
		});
	}
	if (!frontmatter.description) {
		findings.push({
			code: "missing_description",
			severity: "error",
			message: "Frontmatter is missing a description",
		});
	} else if (frontmatter.description.length > DESCRIPTION_CHAR_LIMIT) {
		findings.push({
			code: "description_too_long",
			severity: "warning",
			message: `Description has ${frontmatter.description.length} chars, recommended maximum is ${DESCRIPTION_CHAR_LIMIT}`,
		});
	}
	if (lines > SKILL_LINE_LIMIT) {
		findings.push({
			code: "skill_too_many_lines",
			severity: "warning",
			message: `SKILL.md has ${lines} lines, recommended maximum is ${SKILL_LINE_LIMIT}`,
		});
	}
	if (estimatedTokens > SKILL_TOKEN_LIMIT) {
		findings.push({
			code: "skill_too_many_tokens",
			severity: "warning",
			message: `SKILL.md has about ${estimatedTokens} tokens, recommended maximum is ${SKILL_TOKEN_LIMIT}`,
		});
	}

	const checkedPointers = new Set<string>();
	for (const pointer of pointers) {
		const normalized = normalizePointer(pointer.path);
		if (checkedPointers.has(normalized)) continue;
		checkedPointers.add(normalized);
		const target = resolve(skillPath, normalized);
		if (!target.startsWith(`${resolve(skillPath)}${sep}`)) {
			findings.push({
				code: "unsafe_file_path",
				severity: "error",
				message: `Referenced path escapes the skill directory: ${normalized}`,
				path: normalized,
			});
			continue;
		}
		if (!existsSync(target)) {
			findings.push({
				code: "missing_file",
				severity: "error",
				message: `Referenced file does not exist: ${normalized}`,
				path: normalized,
			});
		}
	}

	for (const file of files) {
		if (file.kind === "reference" && !file.referenced) {
			findings.push({
				code: "unreferenced_reference",
				severity: "warning",
				message: `Reference is not linked from SKILL.md: ${file.path}`,
				path: file.path,
			});
		}
		if (
			file.kind === "reference" &&
			file.referenced &&
			file.explicitInstruction === false
		) {
			findings.push({
				code: "ungated_reference",
				severity: "warning",
				message: `Reference does not say when or why to load it: ${file.path}`,
				path: file.path,
			});
		}
	}

	const referenceFiles = files.filter((file) => file.kind === "reference");
	const scriptFiles = files.filter((file) => file.kind === "script");
	const assetFiles = files.filter((file) => file.kind === "asset");

	return {
		name,
		description: frontmatter.description,
		path: skillPath,
		skillFile,
		status: statusFromFindings(findings),
		metrics: {
			lines,
			chars: content.length,
			estimatedTokens,
			metadataTokens: estimateTokens(
				name.length + frontmatter.description.length,
			),
			referenceTokens: referenceFiles.reduce(
				(sum, file) => sum + (file.estimatedTokens ?? 0),
				0,
			),
			referenceFiles: referenceFiles.length,
			scriptFiles: scriptFiles.length,
			assetFiles: assetFiles.length,
		},
		files,
		findings,
	};
}

function parseFrontmatter(content: string): Frontmatter {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
	if (!match) return { name: "", description: "", body: content };
	const yaml = match[1] ?? "";
	return {
		name: readYamlString(yaml, "name"),
		description: readYamlString(yaml, "description"),
		body: content.slice(match[0].length),
	};
}

function readYamlString(yaml: string, key: string): string {
	const lines = yaml.split("\n");
	const index = lines.findIndex((line) =>
		line.match(new RegExp(`^${key}:\\s*`)),
	);
	if (index === -1) return "";
	const raw = lines[index]?.slice(lines[index]?.indexOf(":") + 1).trim() ?? "";
	if (raw === "|" || raw === ">") {
		const values: string[] = [];
		for (let cursor = index + 1; cursor < lines.length; cursor++) {
			const line = lines[cursor] ?? "";
			if (line.trim() && !line.match(/^\s+/)) break;
			values.push(line.trim());
		}
		return values.filter(Boolean).join(raw === ">" ? " " : "\n");
	}
	return raw.replace(/^['"]|['"]$/g, "");
}

function extractPointerOccurrences(content: string): PointerOccurrence[] {
	const occurrences: PointerOccurrence[] = [];
	const pattern = /(?:references|scripts|assets)\/[\w@./-]+/g;
	const lines = content.split("\n");
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index] ?? "";
		for (const match of line.matchAll(pattern)) {
			occurrences.push({
				path: match[0],
				context: [lines[index - 1] ?? "", line, lines[index + 1] ?? ""].join(
					" ",
				),
			});
		}
	}
	return occurrences;
}

function normalizePointer(path: string): string {
	return path.replace(/^\.\//, "").replace(/[.,:;!?]+$/, "");
}

function scanAuxiliaryFiles(
	skillPath: string,
	pointers: PointerOccurrence[],
	pointerPaths: Set<string>,
): AuditFile[] {
	const files: AuditFile[] = [];
	for (const [directory, kind] of [
		["references", "reference"],
		["scripts", "script"],
		["assets", "asset"],
	] as const) {
		const root = join(skillPath, directory);
		if (!existsSync(root)) continue;
		for (const path of walkFiles(root)) {
			const relativePath = relative(skillPath, path).split(sep).join("/");
			const referenced = pointerPaths.has(relativePath);
			const stat = statSync(path);
			const textMetrics = kind === "asset" ? null : readTextMetrics(path);
			const matchingPointers = pointers.filter(
				(pointer) => normalizePointer(pointer.path) === relativePath,
			);
			files.push({
				path: relativePath,
				kind,
				bytes: stat.size,
				lines: textMetrics?.lines ?? null,
				estimatedTokens: textMetrics?.tokens ?? null,
				referenced,
				explicitInstruction:
					kind === "reference" && referenced
						? matchingPointers.some((pointer) =>
								hasExplicitRouting(pointer.context),
							)
						: null,
			});
		}
	}
	return files.sort((a, b) => a.path.localeCompare(b.path));
}

function walkFiles(root: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const path = join(root, entry.name);
		if (entry.isSymbolicLink()) continue;
		if (entry.isDirectory()) files.push(...walkFiles(path));
		else if (entry.isFile()) files.push(path);
	}
	return files;
}

function readTextMetrics(
	path: string,
): { lines: number; tokens: number } | null {
	try {
		const content = readFileSync(path, "utf-8");
		if (content.includes("\u0000")) return null;
		return {
			lines: content.split("\n").length,
			tokens: estimateTokens(content.length),
		};
	} catch {
		return null;
	}
}

function hasExplicitRouting(context: string): boolean {
	const normalized = context
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
	const words = new Set(normalized.match(/[a-z]+/g) ?? []);
	const hasSpecificCondition = [
		"after",
		"antes",
		"before",
		"cuando",
		"despues",
		"if",
		"si",
		"to",
		"when",
	].some((word) => words.has(word));
	const genericPurpose =
		/\b(for|para)\s+(details|detalles|information|informacion)\b/.test(
			normalized,
		);
	return (
		ACTION_WORDS.some((word) => words.has(normalizeWord(word))) &&
		ROUTING_WORDS.some((word) => words.has(normalizeWord(word))) &&
		(!genericPurpose || hasSpecificCondition)
	);
}

function normalizeWord(word: string): string {
	return word
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
}

function statusFromFindings(findings: AuditFinding[]): AuditStatus {
	if (findings.some((finding) => finding.severity === "error")) return "fail";
	if (findings.length > 0) return "warn";
	return "pass";
}

export function auditSkills(options: AuditOptions): AuditResult {
	const include = options.include ?? [];
	const roots =
		options.paths.length > 0
			? options.paths.map((path) => resolve(path))
			: [process.cwd()];
	const skillPaths = discoverSkillDirectories(options.paths, include);
	if (skillPaths.length === 0) {
		const scope = include.length > 0 ? ` matching ${include.join(", ")}` : "";
		throw new Error(`No skills found${scope} in ${roots.join(", ")}`);
	}
	const skills = skillPaths.map(auditSkill);
	const overlaps = findOverlaps(skills);
	const activation = skills
		.map((skill) => skill.metrics.estimatedTokens)
		.sort((a, b) => a - b);
	const overlapStatus: AuditStatus = overlaps.some(
		(overlap) => overlap.severity === "error",
	)
		? "fail"
		: overlaps.length > 0
			? "warn"
			: "pass";
	const skillStatus: AuditStatus = skills.some(
		(skill) => skill.status === "fail",
	)
		? "fail"
		: skills.some((skill) => skill.status === "warn")
			? "warn"
			: "pass";
	const status =
		overlapStatus === "fail" || skillStatus === "fail"
			? "fail"
			: overlapStatus === "warn" || skillStatus === "warn"
				? "warn"
				: "pass";

	return {
		roots,
		include,
		tokenEstimation: {
			method: "chars_divided_by_3.7",
			approximate: true,
		},
		summary: {
			total: skills.length,
			passed: skills.filter((skill) => skill.status === "pass").length,
			warned: skills.filter((skill) => skill.status === "warn").length,
			failed: skills.filter((skill) => skill.status === "fail").length,
			status,
			catalogTokens: skills.reduce(
				(sum, skill) => sum + skill.metrics.metadataTokens,
				0,
			),
			activationTokens: {
				total: activation.reduce((sum, tokens) => sum + tokens, 0),
				median: median(activation),
				max: activation.at(-1) ?? 0,
			},
			onDemandReferenceTokens: skills.reduce(
				(sum, skill) => sum + skill.metrics.referenceTokens,
				0,
			),
			referenceFiles: skills.reduce(
				(sum, skill) => sum + skill.metrics.referenceFiles,
				0,
			),
			scriptFiles: skills.reduce(
				(sum, skill) => sum + skill.metrics.scriptFiles,
				0,
			),
			assetFiles: skills.reduce(
				(sum, skill) => sum + skill.metrics.assetFiles,
				0,
			),
			findings:
				skills.reduce((sum, skill) => sum + skill.findings.length, 0) +
				overlaps.length,
		},
		overlaps,
		skills,
	};
}

function median(values: number[]): number {
	if (values.length === 0) return 0;
	const middle = Math.floor(values.length / 2);
	if (values.length % 2 === 1) return values[middle] ?? 0;
	return Math.round(((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2);
}

function findOverlaps(skills: SkillAudit[]): SkillOverlap[] {
	const overlaps: SkillOverlap[] = [];
	for (let left = 0; left < skills.length; left++) {
		for (let right = left + 1; right < skills.length; right++) {
			const a = skills[left];
			const b = skills[right];
			if (!a || !b) continue;
			if (a.name.toLowerCase() === b.name.toLowerCase()) {
				overlaps.push({
					skills: [a.name, b.name],
					similarity: 1,
					severity: "error",
					reason: "duplicate_name",
				});
				continue;
			}
			const aWords = meaningfulWords(a.description);
			const bWords = meaningfulWords(b.description);
			if (Math.min(aWords.size, bWords.size) < 5) continue;
			const similarity = jaccard(aWords, bWords);
			if (similarity >= 0.72) {
				overlaps.push({
					skills: [a.name, b.name],
					similarity,
					severity: "warning",
					reason: "similar_description",
				});
			}
		}
	}
	return overlaps.sort((a, b) => b.similarity - a.similarity);
}

function meaningfulWords(description: string): Set<string> {
	const words = description
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.match(/[a-z0-9]+/g);
	return new Set(
		(words ?? []).filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
	);
}

function jaccard(a: Set<string>, b: Set<string>): number {
	const intersection = [...a].filter((word) => b.has(word)).length;
	const union = new Set([...a, ...b]).size;
	return union === 0 ? 0 : intersection / union;
}

export function isStrictFailure(result: AuditResult): boolean {
	return result.summary.status !== "pass";
}
