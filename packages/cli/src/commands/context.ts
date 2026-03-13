import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { scanInstalledSkills } from "../scanner/skills";
import { bold, cyan, dim, green, red, yellow } from "../tui/colors";

const CHARS_PER_TOKEN = 3.7;

const MODEL_PRICING: Record<string, { input: number; cacheWrite: number; cacheRead: number }> = {
	"opus": { input: 15, cacheWrite: 18.75, cacheRead: 1.5 },
	"sonnet": { input: 3, cacheWrite: 3.75, cacheRead: 0.30 },
	"haiku": { input: 0.80, cacheWrite: 1, cacheRead: 0.08 },
};

function charsToTokens(chars: number): number {
	return Math.round(chars / CHARS_PER_TOKEN);
}

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

function costPerMTok(tokens: number, pricePerMillion: number): number {
	return (tokens * pricePerMillion) / 1_000_000;
}

function formatCost(usd: number): string {
	if (usd < 0.0001) return `$${usd.toFixed(6)}`;
	if (usd < 0.01) return `$${usd.toFixed(4)}`;
	return `$${usd.toFixed(4)}`;
}

interface ContextSource {
	name: string;
	path: string;
	chars: number;
	tokens: number;
	type: "claude-md" | "memory" | "skill-metadata" | "skill-body";
}

function findClaudeMdFiles(cwd: string): ContextSource[] {
	const sources: ContextSource[] = [];

	const globalPath = join(homedir(), ".claude", "CLAUDE.md");
	if (existsSync(globalPath)) {
		const content = readFileSync(globalPath, "utf-8");
		sources.push({
			name: "~/.claude/CLAUDE.md",
			path: globalPath,
			chars: content.length,
			tokens: charsToTokens(content.length),
			type: "claude-md",
		});
	}

	let dir = cwd;
	const seen = new Set<string>();
	while (true) {
		const candidate = join(dir, "CLAUDE.md");
		if (existsSync(candidate) && !seen.has(candidate) && candidate !== globalPath) {
			seen.add(candidate);
			const content = readFileSync(candidate, "utf-8");
			const rel = dir === cwd ? "./CLAUDE.md" : candidate.replace(homedir(), "~");
			sources.push({
				name: rel,
				path: candidate,
				chars: content.length,
				tokens: charsToTokens(content.length),
				type: "claude-md",
			});
		}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}

	const localClaudeDir = join(cwd, ".claude");
	if (existsSync(localClaudeDir)) {
		const localClaude = join(localClaudeDir, "CLAUDE.md");
		if (existsSync(localClaude) && !seen.has(localClaude)) {
			const content = readFileSync(localClaude, "utf-8");
			sources.push({
				name: ".claude/CLAUDE.md",
				path: localClaude,
				chars: content.length,
				tokens: charsToTokens(content.length),
				type: "claude-md",
			});
		}
	}

	return sources;
}

function findContextFiles(cwd: string): ContextSource[] {
	const sources: ContextSource[] = [];

	const claudeMdFiles = findClaudeMdFiles(cwd);
	for (const claudeMd of claudeMdFiles) {
		const content = readFileSync(claudeMd.path, "utf-8");
		const atRefs = content.match(/^@(.+\.md)$/gm);
		if (!atRefs) continue;

		for (const ref of atRefs) {
			const refPath = ref.slice(1);
			const fullPath = join(dirname(claudeMd.path), refPath);
			if (existsSync(fullPath)) {
				const refContent = readFileSync(fullPath, "utf-8");
				sources.push({
					name: refPath.replace(/.*\//, ""),
					path: fullPath,
					chars: refContent.length,
					tokens: charsToTokens(refContent.length),
					type: "claude-md",
				});
			}
		}
	}

	return sources;
}

function findMemoryFiles(): ContextSource[] {
	const sources: ContextSource[] = [];

	const projectDirs = join(homedir(), ".claude", "projects");
	if (!existsSync(projectDirs)) return sources;

	const cwd = process.cwd();
	const encodedCwd = cwd.replace(/\//g, "-");

	const projectDir = join(projectDirs, encodedCwd);
	if (!existsSync(projectDir)) return sources;

	const memoryDir = join(projectDir, "memory");
	if (!existsSync(memoryDir)) return sources;

	const memoryIndex = join(memoryDir, "MEMORY.md");
	if (existsSync(memoryIndex)) {
		const content = readFileSync(memoryIndex, "utf-8");
		sources.push({
			name: "MEMORY.md",
			path: memoryIndex,
			chars: content.length,
			tokens: charsToTokens(content.length),
			type: "memory",
		});
	}

	return sources;
}

function getSkillSources(): { metadata: ContextSource[]; bodies: ContextSource[] } {
	const skills = scanInstalledSkills();
	const metadata: ContextSource[] = [];
	const bodies: ContextSource[] = [];

	for (const skill of skills) {
		const skillMdPath = join(skill.path, "SKILL.md");
		if (!existsSync(skillMdPath)) continue;

		try {
			const content = readFileSync(skillMdPath, "utf-8");
			const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);

			let name = skill.name;
			let description = skill.description;

			if (fmMatch) {
				const yaml = fmMatch[1] ?? "";
				const nameMatch = yaml.match(/^name:\s*(.+)$/m);
				if (nameMatch?.[1]) name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
				const descMatch = yaml.match(/^description:\s*(.+)$/m);
				if (descMatch?.[1]) description = descMatch[1].trim().replace(/^["']|["']$/g, "");
			}

			const metaChars = name.length + description.length;
			metadata.push({
				name: name,
				path: skillMdPath,
				chars: metaChars,
				tokens: charsToTokens(metaChars),
				type: "skill-metadata",
			});

			const bodyChars = content.length;
			bodies.push({
				name: name,
				path: skillMdPath,
				chars: bodyChars,
				tokens: charsToTokens(bodyChars),
				type: "skill-body",
			});
		} catch {}
	}

	return { metadata, bodies };
}

export async function runContextCommand(): Promise<void> {
	const args = process.argv.slice(3);
	const isJson = args.includes("--json");
	const model = args.includes("--opus") ? "opus" : args.includes("--haiku") ? "haiku" : "sonnet";
	const turnsFlag = args.indexOf("--turns");
	const avgTurns = turnsFlag >= 0 && args[turnsFlag + 1] ? Number(args[turnsFlag + 1]) : 40;

	const pricing = MODEL_PRICING[model]!;
	const cwd = process.cwd();

	const claudeMdSources = findClaudeMdFiles(cwd);
	const contextFileSources = findContextFiles(cwd);
	const memorySources = findMemoryFiles();
	const { metadata: skillMetadata, bodies: skillBodies } = getSkillSources();

	const alwaysLoaded = [
		...claudeMdSources,
		...contextFileSources,
		...memorySources,
		...skillMetadata,
	];

	const totalAlwaysChars = alwaysLoaded.reduce((sum, s) => sum + s.chars, 0);
	const totalAlwaysTokens = charsToTokens(totalAlwaysChars);

	const claudeMdTokens = charsToTokens(
		[...claudeMdSources, ...contextFileSources].reduce((s, c) => s + c.chars, 0),
	);
	const memoryTokens = charsToTokens(memorySources.reduce((s, c) => s + c.chars, 0));
	const metadataTokens = charsToTokens(skillMetadata.reduce((s, c) => s + c.chars, 0));

	const firstCallCost = costPerMTok(totalAlwaysTokens, pricing.cacheWrite);
	const cachedCallCost = costPerMTok(totalAlwaysTokens, pricing.cacheRead);
	const uncachedCallCost = costPerMTok(totalAlwaysTokens, pricing.input);

	const sessionCostCached = firstCallCost + cachedCallCost * (avgTurns - 1);
	const sessionCostUncached = uncachedCallCost * avgTurns;

	if (isJson) {
		console.log(JSON.stringify({
			model,
			avg_turns: avgTurns,
			always_loaded: {
				total_chars: totalAlwaysChars,
				total_tokens: totalAlwaysTokens,
				claude_md_tokens: claudeMdTokens,
				memory_tokens: memoryTokens,
				skill_metadata_tokens: metadataTokens,
			},
			cost_per_call: {
				first_call_cache_write: firstCallCost,
				subsequent_cache_read: cachedCallCost,
				uncached: uncachedCallCost,
			},
			session_estimate: {
				with_cache: sessionCostCached,
				without_cache: sessionCostUncached,
				savings_pct: ((1 - sessionCostCached / sessionCostUncached) * 100),
			},
			sources: alwaysLoaded.map((s) => ({
				name: s.name,
				type: s.type,
				chars: s.chars,
				tokens: s.tokens,
			})),
			skill_bodies: skillBodies
				.sort((a, b) => b.tokens - a.tokens)
				.slice(0, 10)
				.map((s) => ({ name: s.name, tokens: s.tokens })),
		}, null, 2));
		return;
	}

	console.log("");
	console.log(`  ${bold("CONTEXT TAX")} ${dim(`— ${model} pricing, ${avgTurns} turns/session`)}`);
	console.log("");

	const w = 28;
	console.log(`    ${bold("ALWAYS LOADED")} ${dim("(every API call)")}`);
	console.log(`    ${"CLAUDE.md + refs".padEnd(w)} ${formatTokens(claudeMdTokens).padStart(8)} tokens   ${dim(formatCost(costPerMTok(claudeMdTokens, pricing.cacheRead)))}`);
	console.log(`    ${"Skills metadata".padEnd(w)} ${formatTokens(metadataTokens).padStart(8)} tokens   ${dim(formatCost(costPerMTok(metadataTokens, pricing.cacheRead)))}`);
	if (memoryTokens > 0) {
		console.log(`    ${"Memory (MEMORY.md)".padEnd(w)} ${formatTokens(memoryTokens).padStart(8)} tokens   ${dim(formatCost(costPerMTok(memoryTokens, pricing.cacheRead)))}`);
	}
	console.log(`    ${"─".repeat(w + 25)}`);
	console.log(`    ${bold("Total".padEnd(w))} ${bold(formatTokens(totalAlwaysTokens).padStart(8))} tokens   ${dim(formatCost(cachedCallCost))}${dim("/call (cached)")}`);
	console.log("");

	console.log(`    ${bold("COST PER CALL")}`);
	console.log(`    ${"1st call (cache write)".padEnd(w)} ${formatCost(firstCallCost)}`);
	console.log(`    ${"Subsequent (cache read)".padEnd(w)} ${green(formatCost(cachedCallCost))}`);
	console.log(`    ${"Without cache".padEnd(w)} ${red(formatCost(uncachedCallCost))}`);
	console.log("");

	console.log(`    ${bold("SESSION ESTIMATE")} ${dim(`(${avgTurns} turns)`)}`);
	console.log(`    ${"With prompt caching".padEnd(w)} ${green(formatCost(sessionCostCached))}`);
	console.log(`    ${"Without caching".padEnd(w)} ${red(formatCost(sessionCostUncached))}`);
	const savingsPct = ((1 - sessionCostCached / sessionCostUncached) * 100).toFixed(0);
	console.log(`    ${"Cache savings".padEnd(w)} ${green(`${savingsPct}%`)}`);
	console.log("");

	const sortedSources = [...claudeMdSources, ...contextFileSources]
		.sort((a, b) => b.tokens - a.tokens);

	if (sortedSources.length > 0) {
		console.log(`    ${bold("CLAUDE.MD BREAKDOWN")}`);
		const maxTok = Math.max(...sortedSources.map((s) => s.tokens));
		for (const s of sortedSources.slice(0, 10)) {
			const barLen = Math.round((s.tokens / maxTok) * 15);
			const bar = "█".repeat(barLen) + "░".repeat(15 - barLen);
			console.log(`    ${dim(s.name.padEnd(w))} ${cyan(bar)} ${formatTokens(s.tokens).padStart(6)}`);
		}
		console.log("");
	}

	const sortedMeta = [...skillMetadata].sort((a, b) => b.tokens - a.tokens);
	if (sortedMeta.length > 0) {
		console.log(`    ${bold("TOP SKILLS BY METADATA")} ${dim(`(${skillMetadata.length} total)`)}`);
		const topMeta = sortedMeta.slice(0, 8);
		const maxMetaTok = Math.max(...topMeta.map((s) => s.tokens));
		for (const s of topMeta) {
			const barLen = Math.round((s.tokens / maxMetaTok) * 15);
			const bar = "█".repeat(barLen) + "░".repeat(15 - barLen);
			console.log(`    ${dim(s.name.padEnd(w))} ${cyan(bar)} ${formatTokens(s.tokens).padStart(6)}`);
		}
		if (sortedMeta.length > 8) {
			console.log(`    ${dim(`+${sortedMeta.length - 8} more`)}`);
		}
		console.log("");
	}

	const sortedBodies = [...skillBodies].sort((a, b) => b.tokens - a.tokens);
	if (sortedBodies.length > 0) {
		console.log(`    ${bold("TOP SKILLS BY BODY")} ${dim("(loaded on trigger)")}`);
		const topBodies = sortedBodies.slice(0, 5);
		const maxBodyTok = Math.max(...topBodies.map((s) => s.tokens));
		for (const s of topBodies) {
			const barLen = Math.round((s.tokens / maxBodyTok) * 15);
			const bar = "█".repeat(barLen) + "░".repeat(15 - barLen);
			console.log(`    ${dim(s.name.padEnd(w))} ${cyan(bar)} ${formatTokens(s.tokens).padStart(6)}`);
		}
		console.log("");
	}

	if (totalAlwaysTokens > 15000) {
		console.log(`    ${red("!")} Context tax is ${formatTokens(totalAlwaysTokens)} tokens — consider trimming CLAUDE.md or pruning unused skills`);
		console.log("");
	} else if (totalAlwaysTokens > 8000) {
		console.log(`    ${yellow("!")} Context tax is ${formatTokens(totalAlwaysTokens)} tokens — room to optimize`);
		console.log("");
	}
}
