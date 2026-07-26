import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
	type BaselineSource,
	deleteBaseline,
	diffBaseline,
	formatRelativeAge,
	listBaselines,
	loadBaseline,
	saveBaseline,
} from "../context/baseline";
import {
	discoverMcpServers,
	type McpServerMeasurement,
	measureMcpServers,
} from "../scanner/mcp";
import { scanInstalledSkills } from "../scanner/skills";
import { bold, cyan, dim, green, red, yellow } from "../tui/colors";

const CHARS_PER_TOKEN = 3.7;

const MODEL_PRICING: Record<
	string,
	{ input: number; cacheWrite: number; cacheRead: number }
> = {
	opus: { input: 15, cacheWrite: 18.75, cacheRead: 1.5 },
	sonnet: { input: 3, cacheWrite: 3.75, cacheRead: 0.3 },
	haiku: { input: 0.8, cacheWrite: 1, cacheRead: 0.08 },
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
	type: "claude-md" | "memory" | "skill-metadata" | "skill-body" | "mcp";
}

function mcpToSources(measurements: McpServerMeasurement[]): ContextSource[] {
	return measurements
		.filter((m) => m.status === "ok")
		.map((m) => ({
			name: m.name,
			path: `mcp:${m.name}`,
			chars: m.chars,
			tokens: charsToTokens(m.chars),
			type: "mcp" as const,
		}));
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
		if (
			existsSync(candidate) &&
			!seen.has(candidate) &&
			candidate !== globalPath
		) {
			seen.add(candidate);
			const content = readFileSync(candidate, "utf-8");
			const rel =
				dir === cwd ? "./CLAUDE.md" : candidate.replace(homedir(), "~");
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

const MAX_IMPORT_DEPTH = 5;

/**
 * Resolve `@path/to/file.md` imports reachable from the CLAUDE.md files.
 *
 * Two properties matter for the token total to be right:
 *  - each file is counted once, even when several CLAUDE.md files (or a
 *    chain of imports) reference it, so shared context is not double-billed
 *  - imports are followed transitively, since an imported file may itself
 *    import more, and the model pays for the whole closure
 *
 * Depth is capped and visited paths are tracked, so an import cycle
 * terminates instead of recursing forever.
 */
export function findContextFiles(cwd: string): ContextSource[] {
	const sources: ContextSource[] = [];
	const visited = new Set<string>();

	const claudeMdFiles = findClaudeMdFiles(cwd);
	for (const claudeMd of claudeMdFiles) visited.add(claudeMd.path);

	const walk = (filePath: string, depth: number): void => {
		if (depth > MAX_IMPORT_DEPTH) return;

		let content: string;
		try {
			content = readFileSync(filePath, "utf-8");
		} catch {
			return;
		}

		const atRefs = content.match(/^@(.+\.md)$/gm);
		if (!atRefs) return;

		for (const ref of atRefs) {
			const refPath = ref.slice(1).trim();
			const fullPath = join(dirname(filePath), refPath);
			if (visited.has(fullPath)) continue;
			visited.add(fullPath);

			if (!existsSync(fullPath)) continue;

			const refContent = readFileSync(fullPath, "utf-8");
			sources.push({
				name: refPath.replace(/.*\//, ""),
				path: fullPath,
				chars: refContent.length,
				tokens: charsToTokens(refContent.length),
				type: "claude-md",
			});

			walk(fullPath, depth + 1);
		}
	};

	for (const claudeMd of claudeMdFiles) walk(claudeMd.path, 0);

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

function getSkillSources(): {
	metadata: ContextSource[];
	bodies: ContextSource[];
} {
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
				if (nameMatch?.[1])
					name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
				const descMatch = yaml.match(/^description:\s*(.+)$/m);
				if (descMatch?.[1])
					description = descMatch[1].trim().replace(/^["']|["']$/g, "");
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

function flagValue(args: string[], flag: string): string | undefined {
	const idx = args.indexOf(flag);
	if (idx < 0) return undefined;
	const next = args[idx + 1];
	if (!next || next.startsWith("--")) return undefined;
	return next;
}

export async function runContextCommand(): Promise<void> {
	const args = process.argv.slice(3);
	const isJson = args.includes("--json");
	const model = args.includes("--sonnet")
		? "sonnet"
		: args.includes("--haiku")
			? "haiku"
			: "opus";
	const turnsFlag = args.indexOf("--turns");
	const avgTurns =
		turnsFlag >= 0 && args[turnsFlag + 1] ? Number(args[turnsFlag + 1]) : 40;
	const withMcp = args.includes("--mcp");
	const mcpTimeout = Number(flagValue(args, "--mcp-timeout") ?? 20) * 1000;

	const pricing = MODEL_PRICING[model]!;
	const cwd = process.cwd();

	if (args.includes("--list-baselines")) {
		const all = listBaselines(cwd);
		if (all.length === 0) {
			console.log("");
			console.log(`  ${dim("No baselines saved for this directory.")}`);
			console.log(
				`  ${dim("Create one with:")} skillkit context --save-baseline <name>`,
			);
			console.log("");
			return;
		}
		console.log("");
		console.log(`  ${bold("CONTEXT BASELINES")} ${dim(`(${cwd})`)}`);
		console.log("");
		for (const b of all) {
			console.log(
				`    ${b.name.padEnd(24)} ${formatTokens(b.totalTokens).padStart(8)} tokens   ${dim(formatRelativeAge(b.createdAt))}`,
			);
		}
		console.log("");
		return;
	}

	const toDelete = flagValue(args, "--delete-baseline");
	if (toDelete) {
		const existed = deleteBaseline(toDelete, cwd);
		console.log("");
		console.log(
			existed
				? `  ${green("✓")} Deleted baseline "${toDelete}"`
				: `  ${red("✗")} No baseline named "${toDelete}"`,
		);
		console.log("");
		return;
	}

	const saveName = args.includes("--save-baseline")
		? (flagValue(args, "--save-baseline") ?? "default")
		: undefined;
	const compareName = args.includes("--compare")
		? (flagValue(args, "--compare") ?? "default")
		: undefined;

	const claudeMdSources = findClaudeMdFiles(cwd);
	const contextFileSources = findContextFiles(cwd);
	const memorySources = findMemoryFiles();
	const { metadata: skillMetadata, bodies: skillBodies } = getSkillSources();

	let mcpMeasurements: McpServerMeasurement[] = [];
	let mcpSources: ContextSource[] = [];
	if (withMcp) {
		const servers = discoverMcpServers(cwd);
		if (servers.length > 0) {
			if (!isJson) {
				process.stderr.write(
					dim(
						`  Probing ${servers.length} MCP server${servers.length === 1 ? "" : "s"}...\n`,
					),
				);
			}
			mcpMeasurements = await measureMcpServers(servers, {
				timeoutMs: mcpTimeout,
			});
			mcpSources = mcpToSources(mcpMeasurements);
		}
	}

	const alwaysLoaded = [
		...claudeMdSources,
		...contextFileSources,
		...memorySources,
		...skillMetadata,
		...mcpSources,
	];

	const totalAlwaysChars = alwaysLoaded.reduce((sum, s) => sum + s.chars, 0);
	const totalAlwaysTokens = charsToTokens(totalAlwaysChars);

	const claudeMdTokens = charsToTokens(
		[...claudeMdSources, ...contextFileSources].reduce(
			(s, c) => s + c.chars,
			0,
		),
	);
	const memoryTokens = charsToTokens(
		memorySources.reduce((s, c) => s + c.chars, 0),
	);
	const metadataTokens = charsToTokens(
		skillMetadata.reduce((s, c) => s + c.chars, 0),
	);
	const mcpTokens = charsToTokens(mcpSources.reduce((s, c) => s + c.chars, 0));

	const currentSources: BaselineSource[] = alwaysLoaded.map((s) => ({
		name: s.name,
		type: s.type,
		tokens: s.tokens,
	}));

	const diff = compareName
		? (() => {
				const stored = loadBaseline(compareName, cwd);
				return stored ? diffBaseline(stored, currentSources) : null;
			})()
		: null;
	const compareMissing = Boolean(compareName) && !diff;

	const firstCallCost = costPerMTok(totalAlwaysTokens, pricing.cacheWrite);
	const cachedCallCost = costPerMTok(totalAlwaysTokens, pricing.cacheRead);
	const uncachedCallCost = costPerMTok(totalAlwaysTokens, pricing.input);

	const sessionCostCached = firstCallCost + cachedCallCost * (avgTurns - 1);
	const sessionCostUncached = uncachedCallCost * avgTurns;

	if (saveName) {
		saveBaseline({
			name: saveName,
			createdAt: new Date().toISOString(),
			cwd,
			totalTokens: totalAlwaysTokens,
			sources: currentSources,
		});
	}

	if (isJson) {
		console.log(
			JSON.stringify(
				{
					model,
					avg_turns: avgTurns,
					always_loaded: {
						total_chars: totalAlwaysChars,
						total_tokens: totalAlwaysTokens,
						claude_md_tokens: claudeMdTokens,
						memory_tokens: memoryTokens,
						skill_metadata_tokens: metadataTokens,
						mcp_tokens: mcpTokens,
					},
					mcp: withMcp
						? {
								measured: mcpMeasurements.filter((m) => m.status === "ok")
									.length,
								total: mcpMeasurements.length,
								servers: mcpMeasurements.map((m) => ({
									name: m.name,
									scope: m.scope,
									transport: m.transport,
									status: m.status,
									tool_count: m.toolCount,
									tokens: charsToTokens(m.chars),
									reason: m.reason,
								})),
							}
						: null,
					baseline_saved: saveName ?? null,
					comparison: diff
						? {
								baseline: diff.baseline.name,
								baseline_created_at: diff.baseline.createdAt,
								total_before: diff.totalBefore,
								total_after: diff.totalAfter,
								total_delta: diff.totalDelta,
								pct_delta: diff.pctDelta,
								changes: diff.changes.map((c) => ({
									name: c.name,
									type: c.type,
									kind: c.kind,
									before: c.before,
									after: c.after,
									delta: c.delta,
								})),
							}
						: null,
					cost_per_call: {
						first_call_cache_write: firstCallCost,
						subsequent_cache_read: cachedCallCost,
						uncached: uncachedCallCost,
					},
					session_estimate: {
						with_cache: sessionCostCached,
						without_cache: sessionCostUncached,
						savings_pct: (1 - sessionCostCached / sessionCostUncached) * 100,
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
				},
				null,
				2,
			),
		);
		return;
	}

	console.log("");
	console.log(
		`  ${bold("CONTEXT TAX")} ${dim(`— ${model} pricing, ${avgTurns} turns/session`)}`,
	);
	console.log("");

	const w = 28;
	console.log(`    ${bold("ALWAYS LOADED")} ${dim("(every API call)")}`);
	console.log(
		`    ${"CLAUDE.md + refs".padEnd(w)} ${formatTokens(claudeMdTokens).padStart(8)} tokens   ${dim(formatCost(costPerMTok(claudeMdTokens, pricing.cacheRead)))}`,
	);
	console.log(
		`    ${"Skills metadata".padEnd(w)} ${formatTokens(metadataTokens).padStart(8)} tokens   ${dim(formatCost(costPerMTok(metadataTokens, pricing.cacheRead)))}`,
	);
	if (memoryTokens > 0) {
		console.log(
			`    ${"Memory (MEMORY.md)".padEnd(w)} ${formatTokens(memoryTokens).padStart(8)} tokens   ${dim(formatCost(costPerMTok(memoryTokens, pricing.cacheRead)))}`,
		);
	}
	if (mcpTokens > 0) {
		console.log(
			`    ${"MCP tool schemas".padEnd(w)} ${formatTokens(mcpTokens).padStart(8)} tokens   ${dim(formatCost(costPerMTok(mcpTokens, pricing.cacheRead)))}`,
		);
	}
	console.log(`    ${"─".repeat(w + 25)}`);
	console.log(
		`    ${bold("Total".padEnd(w))} ${bold(formatTokens(totalAlwaysTokens).padStart(8))} tokens   ${dim(formatCost(cachedCallCost))}${dim("/call (cached)")}`,
	);
	console.log("");

	console.log(`    ${bold("COST PER CALL")}`);
	console.log(
		`    ${"1st call (cache write)".padEnd(w)} ${formatCost(firstCallCost)}`,
	);
	console.log(
		`    ${"Subsequent (cache read)".padEnd(w)} ${green(formatCost(cachedCallCost))}`,
	);
	console.log(
		`    ${"Without cache".padEnd(w)} ${red(formatCost(uncachedCallCost))}`,
	);
	console.log("");

	console.log(`    ${bold("SESSION ESTIMATE")} ${dim(`(${avgTurns} turns)`)}`);
	console.log(
		`    ${"With prompt caching".padEnd(w)} ${green(formatCost(sessionCostCached))}`,
	);
	console.log(
		`    ${"Without caching".padEnd(w)} ${red(formatCost(sessionCostUncached))}`,
	);
	const savingsPct = (
		(1 - sessionCostCached / sessionCostUncached) *
		100
	).toFixed(0);
	console.log(`    ${"Cache savings".padEnd(w)} ${green(`${savingsPct}%`)}`);
	console.log("");

	const sortedSources = [...claudeMdSources, ...contextFileSources].sort(
		(a, b) => b.tokens - a.tokens,
	);

	if (sortedSources.length > 0) {
		console.log(`    ${bold("CLAUDE.MD BREAKDOWN")}`);
		const maxTok = Math.max(...sortedSources.map((s) => s.tokens));
		for (const s of sortedSources.slice(0, 10)) {
			const barLen = Math.round((s.tokens / maxTok) * 15);
			const bar = "█".repeat(barLen) + "░".repeat(15 - barLen);
			console.log(
				`    ${dim(s.name.padEnd(w))} ${cyan(bar)} ${formatTokens(s.tokens).padStart(6)}`,
			);
		}
		console.log("");
	}

	const sortedMeta = [...skillMetadata].sort((a, b) => b.tokens - a.tokens);
	if (sortedMeta.length > 0) {
		console.log(
			`    ${bold("TOP SKILLS BY METADATA")} ${dim(`(${skillMetadata.length} total)`)}`,
		);
		const topMeta = sortedMeta.slice(0, 8);
		const maxMetaTok = Math.max(...topMeta.map((s) => s.tokens));
		for (const s of topMeta) {
			const barLen = Math.round((s.tokens / maxMetaTok) * 15);
			const bar = "█".repeat(barLen) + "░".repeat(15 - barLen);
			console.log(
				`    ${dim(s.name.padEnd(w))} ${cyan(bar)} ${formatTokens(s.tokens).padStart(6)}`,
			);
		}
		if (sortedMeta.length > 8) {
			console.log(`    ${dim(`+${sortedMeta.length - 8} more`)}`);
		}
		console.log("");
	}

	const sortedBodies = [...skillBodies].sort((a, b) => b.tokens - a.tokens);
	if (sortedBodies.length > 0) {
		console.log(
			`    ${bold("TOP SKILLS BY BODY")} ${dim("(loaded on trigger)")}`,
		);
		const topBodies = sortedBodies.slice(0, 5);
		const maxBodyTok = Math.max(...topBodies.map((s) => s.tokens));
		for (const s of topBodies) {
			const barLen = Math.round((s.tokens / maxBodyTok) * 15);
			const bar = "█".repeat(barLen) + "░".repeat(15 - barLen);
			console.log(
				`    ${dim(s.name.padEnd(w))} ${cyan(bar)} ${formatTokens(s.tokens).padStart(6)}`,
			);
		}
		console.log("");
	}

	if (withMcp && mcpMeasurements.length > 0) {
		const ok = mcpMeasurements.filter((m) => m.status === "ok");
		const failed = mcpMeasurements.filter((m) => m.status !== "ok");

		console.log(
			`    ${bold("MCP SERVERS")} ${dim(`(${ok.length}/${mcpMeasurements.length} measured)`)}`,
		);
		const sortedMcp = [...ok].sort((a, b) => b.chars - a.chars);
		if (sortedMcp.length > 0) {
			const maxMcpChars = Math.max(...sortedMcp.map((m) => m.chars));
			for (const m of sortedMcp) {
				const barLen = Math.round((m.chars / maxMcpChars) * 15);
				const bar = "█".repeat(barLen) + "░".repeat(15 - barLen);
				const label = `${m.name} ${dim(`(${m.toolCount})`)}`;
				const pad = Math.max(
					0,
					w - m.name.length - String(m.toolCount).length - 3,
				);
				console.log(
					`    ${dim(label)}${" ".repeat(pad)} ${cyan(bar)} ${formatTokens(charsToTokens(m.chars)).padStart(6)}`,
				);
			}
		}
		for (const m of failed) {
			console.log(
				`    ${dim(m.name.padEnd(w))} ${yellow("unmeasured")} ${dim(m.reason ?? m.status)}`,
			);
		}
		console.log("");
	} else if (withMcp) {
		console.log(`    ${dim("No MCP servers configured for this directory.")}`);
		console.log("");
	}

	if (compareMissing) {
		console.log(
			`    ${yellow("!")} No baseline named "${compareName}" for this directory`,
		);
		console.log(
			`      ${dim("Save one with:")} skillkit context --save-baseline ${compareName}`,
		);
		console.log("");
	}

	if (diff) {
		const sign = diff.totalDelta >= 0 ? "+" : "";
		const deltaColor =
			diff.totalDelta > 0 ? red : diff.totalDelta < 0 ? green : dim;
		console.log(
			`    ${bold("CONTEXT DRIFT")} ${dim(`(vs "${diff.baseline.name}", ${formatRelativeAge(diff.baseline.createdAt)})`)}`,
		);
		console.log(
			`    ${"Total".padEnd(w)} ${formatTokens(diff.totalBefore)} → ${bold(formatTokens(diff.totalAfter))}   ${deltaColor(`${sign}${formatTokens(Math.abs(diff.totalDelta))} (${sign}${diff.pctDelta.toFixed(0)}%)`)}`,
		);
		if (diff.changes.length === 0) {
			console.log(`    ${dim("No per-source changes.")}`);
		} else {
			console.log("");
			for (const c of diff.changes.slice(0, 12)) {
				const marker =
					c.kind === "added"
						? green("+")
						: c.kind === "removed"
							? red("-")
							: dim("~");
				const dSign = c.delta >= 0 ? "+" : "";
				const dColor = c.delta > 0 ? red : green;
				const detail =
					c.kind === "changed"
						? `${formatTokens(c.before)} → ${formatTokens(c.after)}`
						: c.kind === "added"
							? dim("new")
							: dim("gone");
				console.log(
					`    ${marker} ${c.name.padEnd(w - 2)} ${detail.padStart(16)}   ${dColor(`${dSign}${formatTokens(Math.abs(c.delta))}`)}`,
				);
			}
			if (diff.changes.length > 12) {
				console.log(`    ${dim(`+${diff.changes.length - 12} more changes`)}`);
			}
		}
		console.log("");
	}

	if (saveName) {
		console.log(
			`    ${green("✓")} Baseline "${saveName}" saved (${formatTokens(totalAlwaysTokens)} tokens)`,
		);
		console.log("");
	}

	if (!withMcp && discoverMcpServers(cwd).length > 0) {
		console.log(
			`    ${dim("MCP servers detected but not measured. Run with --mcp to include them.")}`,
		);
		console.log("");
	}

	if (totalAlwaysTokens > 15000) {
		console.log(
			`    ${red("!")} Context tax is ${formatTokens(totalAlwaysTokens)} tokens — consider trimming CLAUDE.md or pruning unused skills`,
		);
		console.log("");
	} else if (totalAlwaysTokens > 8000) {
		console.log(
			`    ${yellow("!")} Context tax is ${formatTokens(totalAlwaysTokens)} tokens — room to optimize`,
		);
		console.log("");
	}
}
