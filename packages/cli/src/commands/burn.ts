import { Database } from "bun:sqlite";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { upsertDailyUsage } from "../db/queries";
import { getDb } from "../db/schema";
import { parseAgentFilter } from "../tui/args";
import { bold, cyan, dim, green, red, yellow } from "../tui/colors";

interface ModelPricing {
	input: number;
	output: number;
	cacheCreate?: number;
	cacheRead?: number;
	avgIn?: number;
	avgOut?: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
	"claude-opus-4": { input: 15, output: 75, cacheCreate: 18.75, cacheRead: 1.5 },
	"claude-sonnet-4": { input: 3, output: 15, cacheCreate: 3.75, cacheRead: 0.3 },
	"claude-haiku-4": { input: 0.8, output: 4, cacheCreate: 1, cacheRead: 0.08 },
	"claude-3-5-sonnet": { input: 3, output: 15, cacheCreate: 3.75, cacheRead: 0.3 },
	"claude-3-5-haiku": { input: 0.8, output: 4, cacheCreate: 1, cacheRead: 0.08 },
	"claude-3-opus": { input: 15, output: 75, cacheCreate: 18.75, cacheRead: 1.5 },

	"gpt-5.4": { input: 2.5, output: 15, avgIn: 8000, avgOut: 2000 },
	"gpt-5.4-medium": { input: 2.5, output: 15, avgIn: 8000, avgOut: 2000 },
	"gpt-5.2": { input: 1.75, output: 14, avgIn: 8000, avgOut: 2000 },
	"gpt-5": { input: 1.25, output: 10, avgIn: 8000, avgOut: 2000 },
	"gpt-4.1": { input: 2, output: 8, avgIn: 8000, avgOut: 2000 },
	"gpt-4.1-mini": { input: 0.4, output: 1.6, avgIn: 6000, avgOut: 1500 },
	"gpt-4.1-nano": { input: 0.1, output: 0.4, avgIn: 4000, avgOut: 1000 },
	"gpt-4o": { input: 2.5, output: 10, avgIn: 8000, avgOut: 2000 },
	"gpt-4o-mini": { input: 0.15, output: 0.6, avgIn: 6000, avgOut: 1500 },

	"o3": { input: 2, output: 8, avgIn: 10000, avgOut: 4000 },
	"o3-mini": { input: 1.1, output: 4.4, avgIn: 8000, avgOut: 3000 },
	"o4-mini": { input: 1.1, output: 4.4, avgIn: 8000, avgOut: 3000 },
	"o1": { input: 15, output: 60, avgIn: 10000, avgOut: 4000 },
	"o1-mini": { input: 1.1, output: 4.4, avgIn: 8000, avgOut: 3000 },

	"gemini-2.5-pro": { input: 1.25, output: 10, avgIn: 10000, avgOut: 3000 },
	"gemini-2.5-flash": { input: 0.15, output: 0.6, avgIn: 8000, avgOut: 2000 },
	"gemini-2.0-flash": { input: 0.1, output: 0.4, avgIn: 8000, avgOut: 2000 },
	"gemini-2.0-pro": { input: 1.25, output: 10, avgIn: 10000, avgOut: 3000 },
	"gemini-1.5-pro": { input: 1.25, output: 5, avgIn: 8000, avgOut: 2000 },
	"gemini-1.5-flash": { input: 0.075, output: 0.3, avgIn: 6000, avgOut: 1500 },

	"grok-3": { input: 3, output: 15, avgIn: 10000, avgOut: 3000 },
	"grok-3-fast": { input: 5, output: 25, avgIn: 10000, avgOut: 3000 },
	"grok-3-mini": { input: 0.3, output: 0.5, avgIn: 6000, avgOut: 2000 },
	"grok-3-mini-fast": { input: 0.6, output: 4, avgIn: 6000, avgOut: 2000 },
	"grok-2": { input: 2, output: 10, avgIn: 8000, avgOut: 2000 },

	"deepseek-v3": { input: 0.27, output: 1.1, avgIn: 8000, avgOut: 2000 },
	"deepseek-r1": { input: 0.55, output: 2.19, avgIn: 10000, avgOut: 4000 },
	"deepseek-chat": { input: 0.27, output: 1.1, avgIn: 8000, avgOut: 2000 },
	"deepseek-reasoner": { input: 0.55, output: 2.19, avgIn: 10000, avgOut: 4000 },

	"llama-4-maverick": { input: 0.2, output: 0.6, avgIn: 8000, avgOut: 2000 },
	"llama-4-scout": { input: 0.15, output: 0.4, avgIn: 6000, avgOut: 1500 },
	"llama-3.3-70b": { input: 0.18, output: 0.18, avgIn: 6000, avgOut: 1500 },
	"llama-3.1-405b": { input: 0.8, output: 0.8, avgIn: 8000, avgOut: 2000 },

	"mistral-large": { input: 2, output: 6, avgIn: 8000, avgOut: 2000 },
	"mistral-medium": { input: 0.4, output: 1.5, avgIn: 6000, avgOut: 1500 },
	"mistral-small": { input: 0.1, output: 0.3, avgIn: 4000, avgOut: 1000 },
	"codestral": { input: 0.3, output: 0.9, avgIn: 6000, avgOut: 2000 },

	"command-r-plus": { input: 2.5, output: 10, avgIn: 8000, avgOut: 2000 },
	"command-r": { input: 0.15, output: 0.6, avgIn: 6000, avgOut: 1500 },

	"composer-1.5": { input: 1.25, output: 10, avgIn: 10000, avgOut: 3000 },
	"cursor-small": { input: 0.15, output: 0.6, avgIn: 600, avgOut: 50 },
};

const FALLBACK_PRICING: ModelPricing = {
	input: 2, output: 10, cacheCreate: 2.5, cacheRead: 0.2, avgIn: 8000, avgOut: 2000,
};

const PRICING_PR_URL = "https://github.com/crafter-station/skill-kit/issues/new?title=Add+model+pricing:+MODEL_NAME&labels=pricing";

const KNOWN_PLANS: Record<string, Record<string, number>> = {
	claude: {
		free: 0,
		pro: 20,
		"max (5x)": 100,
		"max (20x)": 200,
		team: 30,
		"team premium": 150,
	},
	cursor: {
		free: 0,
		pro: 20,
		"pro+": 60,
		ultra: 200,
		business: 40,
	},
	copilot: {
		free: 0,
		pro: 10,
		"pro+": 39,
		business: 19,
		enterprise: 39,
	},
	windsurf: {
		free: 0,
		pro: 15,
		teams: 30,
		enterprise: 60,
	},
};

const DEFAULT_PLANS: Record<string, number> = {
	claude: 200,
	cursor: 20,
	copilot: 10,
	windsurf: 15,
};

const CONFIG_PATH = join(homedir(), ".skillkit", "config.json");

interface SkillkitConfig {
	plans?: Record<string, number>;
}

function loadConfig(): SkillkitConfig {
	try {
		if (existsSync(CONFIG_PATH)) {
			return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as SkillkitConfig;
		}
	} catch {}
	return {};
}

function saveConfig(config: SkillkitConfig): void {
	const dir = join(homedir(), ".skillkit");
	if (!existsSync(dir)) {
		Bun.spawnSync(["mkdir", "-p", dir]);
	}
	Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getAgentPlan(agent: string, args: string[]): number {
	const flagName = `--${agent}-plan`;
	const flagIdx = args.indexOf(flagName);
	if (flagIdx >= 0 && args[flagIdx + 1]) {
		const val = args[flagIdx + 1]!;
		const tierPrice = KNOWN_PLANS[agent]?.[val.toLowerCase()];
		if (tierPrice !== undefined) return tierPrice;
		const num = Number(val);
		if (!Number.isNaN(num)) return num;
	}

	const genericIdx = args.indexOf("--plan");
	if (genericIdx >= 0 && args[genericIdx + 1]) {
		return Number(args[genericIdx + 1]);
	}

	const config = loadConfig();
	if (config.plans?.[agent] !== undefined) return config.plans[agent]!;

	return DEFAULT_PLANS[agent] ?? 200;
}

const unmappedModelsWarned = new Set<string>();

const INTERNAL_MODELS = /^<.*>$|^synthetic$|^test$|^unknown$/i;

/**
 * Standard cache multipliers, used when a model has no published cache
 * pricing of its own: a cache write costs 1.25x input, a cache read 0.1x.
 *
 * Most entries in MODEL_PRICING (every non-Anthropic one) omit cacheCreate
 * and cacheRead. Reading those straight off the record yields `undefined`,
 * and `tokens * undefined` is NaN, which then propagates through every
 * running total it touches and silently voids the whole cost report.
 */
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

/** Pricing with every cost field guaranteed present. */
type ResolvedPricing = Required<
	Pick<ModelPricing, "input" | "output" | "cacheCreate" | "cacheRead">
> &
	Pick<ModelPricing, "avgIn" | "avgOut">;

function resolvePricing(pricing: ModelPricing): ResolvedPricing {
	return {
		input: pricing.input,
		output: pricing.output,
		cacheCreate: pricing.cacheCreate ?? pricing.input * CACHE_WRITE_MULTIPLIER,
		cacheRead: pricing.cacheRead ?? pricing.input * CACHE_READ_MULTIPLIER,
		avgIn: pricing.avgIn,
		avgOut: pricing.avgOut,
	};
}

export function getPricing(model: string): ResolvedPricing {
	for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
		if (model.includes(key)) return resolvePricing(pricing);
	}
	if (!INTERNAL_MODELS.test(model) && !unmappedModelsWarned.has(model)) {
		unmappedModelsWarned.add(model);
	}
	return resolvePricing(FALLBACK_PRICING);
}

export function shouldPromptForPlan(
	isTTY: boolean,
	hasPlans: boolean,
	isJson: boolean,
): boolean {
	return isTTY && !hasPlans && !isJson;
}

function printUnmappedWarning(): void {
	if (unmappedModelsWarned.size === 0) return;
	const models = [...unmappedModelsWarned].join(", ");
	console.log(
		`  ${yellow("!")} Unknown model pricing: ${bold(models)}`,
	);
	console.log(
		`    Using estimated mid-tier pricing ($2/$10 per 1M tokens).`,
	);
	console.log(
		`    Help us add it: ${dim(PRICING_PR_URL.replace("MODEL_NAME", encodeURIComponent([...unmappedModelsWarned][0] ?? "")))}`,
	);
	console.log("");
}

interface DayBurn {
	date: string;
	sessions: number;
	apiCalls: number;
	inputTokens: number;
	outputTokens: number;
	cacheCreateTokens: number;
	cacheReadTokens: number;
	costUsd: number;
}

interface ModelBurn {
	model: string;
	apiCalls: number;
	costUsd: number;
}

interface BurnData {
	agent: string;
	totalSessions: number;
	totalApiCalls: number;
	totalInput: number;
	totalOutput: number;
	totalCacheCreate: number;
	totalCacheRead: number;
	totalCost: number;
	dailyMap: Map<string, DayBurn>;
	modelMap: Map<string, ModelBurn>;
	estimated: boolean;
}

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

function formatCost(usd: number): string {
	if (usd < 0.01) return `$${usd.toFixed(4)}`;
	if (usd < 1) return `$${usd.toFixed(3)}`;
	return `$${usd.toFixed(2)}`;
}

function scanClaudeBurn(days: number): BurnData {
	const data: BurnData = {
		agent: "claude",
		totalSessions: 0,
		totalApiCalls: 0,
		totalInput: 0,
		totalOutput: 0,
		totalCacheCreate: 0,
		totalCacheRead: 0,
		totalCost: 0,
		dailyMap: new Map(),
		modelMap: new Map(),
		estimated: false,
	};

	const projectsDir = join(homedir(), ".claude", "projects");
	if (!existsSync(projectsDir)) return data;

	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - days);
	const cutoffTs = cutoff.getTime();

	const glob = new Bun.Glob("**/*.jsonl");
	for (const file of glob.scanSync({ cwd: projectsDir, absolute: true })) {
		try {
			const stat = statSync(file);
			if (stat.mtimeMs < cutoffTs) continue;
		} catch {
			continue;
		}

		let content: string;
		try {
			content = readFileSync(file, "utf-8");
		} catch {
			continue;
		}

		let sessionHasData = false;
		const lines = content.split("\n");

		for (const line of lines) {
			if (!line.trim()) continue;
			let obj: Record<string, unknown>;
			try {
				obj = JSON.parse(line);
			} catch {
				continue;
			}

			if (obj.type !== "assistant") continue;
			const msg = obj.message as Record<string, unknown> | undefined;
			if (!msg) continue;
			const usage = msg.usage as Record<string, unknown> | undefined;
			if (!usage) continue;

			const inputTok = (usage.input_tokens as number) ?? 0;
			const outputTok = (usage.output_tokens as number) ?? 0;
			const cacheCreateTok =
				(usage.cache_creation_input_tokens as number) ?? 0;
			const cacheReadTok =
				(usage.cache_read_input_tokens as number) ?? 0;

			const model = (msg.model as string) ?? "unknown";
			const pricing = getPricing(model);
			const cost =
				(inputTok * pricing.input +
					outputTok * pricing.output +
					cacheCreateTok * pricing.cacheCreate +
					cacheReadTok * pricing.cacheRead) /
				1_000_000;

			const ts = (obj.timestamp as string) ?? "";
			const date = ts.slice(0, 10);

			if (!data.dailyMap.has(date)) {
				data.dailyMap.set(date, {
					date,
					sessions: 0,
					apiCalls: 0,
					inputTokens: 0,
					outputTokens: 0,
					cacheCreateTokens: 0,
					cacheReadTokens: 0,
					costUsd: 0,
				});
			}
			const day = data.dailyMap.get(date)!;
			day.apiCalls++;
			day.inputTokens += inputTok;
			day.outputTokens += outputTok;
			day.cacheCreateTokens += cacheCreateTok;
			day.cacheReadTokens += cacheReadTok;
			day.costUsd += cost;

			const modelKey = model.replace(/-\d{8}$/, "");
			if (!data.modelMap.has(modelKey)) {
				data.modelMap.set(modelKey, { model: modelKey, apiCalls: 0, costUsd: 0 });
			}
			const m = data.modelMap.get(modelKey)!;
			m.apiCalls++;
			m.costUsd += cost;

			data.totalApiCalls++;
			data.totalInput += inputTok;
			data.totalOutput += outputTok;
			data.totalCacheCreate += cacheCreateTok;
			data.totalCacheRead += cacheReadTok;
			data.totalCost += cost;
			sessionHasData = true;
		}

		if (sessionHasData) data.totalSessions++;
	}

	return data;
}


function scanCursorBurn(days: number): BurnData {
	const data: BurnData = {
		agent: "cursor",
		totalSessions: 0,
		totalApiCalls: 0,
		totalInput: 0,
		totalOutput: 0,
		totalCacheCreate: 0,
		totalCacheRead: 0,
		totalCost: 0,
		dailyMap: new Map(),
		modelMap: new Map(),
		estimated: false,
	};

	const trackingDb = join(
		homedir(),
		".cursor",
		"ai-tracking",
		"ai-code-tracking.db",
	);
	if (!existsSync(trackingDb)) return data;

	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - days);
	const cutoffMs = cutoff.getTime();

	try {
		const db = new Database(trackingDb, { readonly: true });

		const dailyRows = db
			.query<
				{ day: string; model: string; edits: number },
				[number]
			>(
				`SELECT date(createdAt/1000, 'unixepoch', 'localtime') as day,
				COALESCE(model, 'cursor-default') as model,
				COUNT(*) as edits
			FROM ai_code_hashes
			WHERE createdAt >= ?
			GROUP BY day, model
			ORDER BY day`,
			)
			.all(cutoffMs);

		for (const row of dailyRows) {
			if (!data.dailyMap.has(row.day)) {
				data.dailyMap.set(row.day, {
					date: row.day,
					sessions: 0,
					apiCalls: 0,
					inputTokens: 0,
					outputTokens: 0,
					cacheCreateTokens: 0,
					cacheReadTokens: 0,
					costUsd: 0,
				});
			}
			const day = data.dailyMap.get(row.day)!;
			day.apiCalls += row.edits;
			data.totalApiCalls += row.edits;

			const modelKey = row.model || "cursor-default";

			if (!data.modelMap.has(modelKey)) {
				data.modelMap.set(modelKey, {
					model: modelKey,
					apiCalls: 0,
					costUsd: 0,
				});
			}
			const m = data.modelMap.get(modelKey)!;
			m.apiCalls += row.edits;
		}

		const convCount = db
			.query<{ c: number }, [number]>(
				`SELECT COUNT(DISTINCT conversationId) as c
			FROM ai_code_hashes
			WHERE createdAt >= ? AND conversationId IS NOT NULL`,
			)
			.get(cutoffMs);
		data.totalSessions = convCount?.c ?? 0;

		db.close();
	} catch {
		return data;
	}

	return data;
}

function printBurnData(data: BurnData, plan: number): void {
	const sortedDays = [...data.dailyMap.values()].sort((a, b) =>
		a.date.localeCompare(b.date),
	);
	const daysElapsed = sortedDays.length || 1;
	const sortedModels = [...data.modelMap.values()].sort(
		(a, b) => b.apiCalls - a.apiCalls,
	);

	const isCursor = data.agent === "cursor";
	console.log(`    ${isCursor ? "Conversations" : "Sessions"}:  ${bold(String(data.totalSessions))}`);
	console.log(`    ${isCursor ? "Code edits" : "API calls"}:    ${bold(String(data.totalApiCalls))}`);
	console.log("");

	if (data.totalInput + data.totalOutput > 0) {
		console.log(
			`    ${bold("TOKENS")} ${data.estimated ? dim("(estimated from code hashes)") : ""}`,
		);
		console.log(`    Input:        ${formatTokens(data.totalInput)}`);
		console.log(`    Output:       ${formatTokens(data.totalOutput)}`);
		if (data.totalCacheCreate > 0)
			console.log(
				`    Cache create: ${formatTokens(data.totalCacheCreate)}`,
			);
		if (data.totalCacheRead > 0)
			console.log(
				`    Cache read:   ${formatTokens(data.totalCacheRead)}`,
			);
		console.log("");
	}

	if (data.totalCost > 0) {
		const dailyAvg = data.totalCost / daysElapsed;
		const projected = dailyAvg * 31;
		const utilization = (data.totalCost / plan) * 100;
		const utilizationColor =
			utilization > 100 ? red : utilization > 80 ? yellow : green;

		console.log(`    ${bold("COST")}`);
		console.log(`    Total:        ${bold(formatCost(data.totalCost))}`);
		console.log(`    Daily avg:    ${formatCost(dailyAvg)}`);
		console.log(`    Projected/mo: ${formatCost(projected)}`);
		console.log(`    Plan:         ${dim(`$${plan}/mo`)}`);
		console.log(
			`    Utilization:  ${utilizationColor(`${utilization.toFixed(0)}%`)}`,
		);
		console.log("");
	}

	if (sortedModels.length > 0) {
		console.log(`    ${bold("BY MODEL")}`);
		const maxModelCalls = Math.max(...sortedModels.map((m) => m.apiCalls));
		for (const m of sortedModels) {
			const barLen = Math.round((m.apiCalls / maxModelCalls) * 15);
			const bar = "█".repeat(barLen) + "░".repeat(15 - barLen);
			const name = m.model.padEnd(28);
			const unit = isCursor ? "edits" : "calls";
			if (m.costUsd > 0) {
				console.log(
					`    ${dim(name)} ${cyan(bar)} ${formatCost(m.costUsd)} ${dim(`(${m.apiCalls} ${unit})`)}`,
				);
			} else {
				console.log(
					`    ${dim(name)} ${cyan(bar)} ${dim(`${m.apiCalls} ${unit}`)}`,
				);
			}
		}
		console.log("");
	}

	if (sortedDays.length > 1) {
		const maxDayVal = Math.max(
			...sortedDays.map((d) => (data.totalCost > 0 ? d.costUsd : d.apiCalls)),
		);
		const recentDays = sortedDays.slice(-14);
		console.log(`    ${bold("DAILY BURN")}`);
		for (const d of recentDays) {
			const val = data.totalCost > 0 ? d.costUsd : d.apiCalls;
			const barLen = Math.round((val / maxDayVal) * 20);
			const bar = "█".repeat(barLen) + "░".repeat(20 - barLen);
			const weekday = new Date(d.date + "T12:00:00")
				.toLocaleDateString("en", { weekday: "short" })
				.slice(0, 3);
			const label =
				data.totalCost > 0
					? formatCost(d.costUsd)
					: `${d.apiCalls} ${isCursor ? "edits" : "calls"}`;
			console.log(
				`    ${dim(d.date)} ${dim(weekday)} ${cyan(bar)} ${label}`,
			);
		}
		console.log("");
	}
}

function printAiContribution(): void {
	const trackingDb = join(
		homedir(),
		".cursor",
		"ai-tracking",
		"ai-code-tracking.db",
	);
	if (!existsSync(trackingDb)) return;

	try {
		const db = new Database(trackingDb, { readonly: true });
		const stats = db
			.query<
				{
					total: number;
					avgPct: number;
					totalLines: number;
					aiLines: number;
					humanLines: number;
				},
				[]
			>(
				`SELECT COUNT(*) as total,
			AVG(CAST(v2AiPercentage AS REAL)) as avgPct,
			SUM(linesAdded) as totalLines,
			SUM(composerLinesAdded) as aiLines,
			SUM(humanLinesAdded) as humanLines
		FROM scored_commits`,
			)
			.get();
		db.close();

		if (stats && stats.total > 0) {
			console.log(`    ${bold("AI CODE CONTRIBUTION")}`);
			console.log(
				`    Commits scored: ${bold(String(stats.total))}`,
			);
			console.log(
				`    AI written:     ${bold(`${stats.avgPct?.toFixed(1)}%`)}`,
			);
			console.log(
				`    Lines:          ${dim(`${stats.aiLines} AI / ${stats.humanLines} human`)}`,
			);
			console.log("");
		}
	} catch {}
}

interface SelectOption {
	label: string;
	value: number;
}

function select(title: string, options: SelectOption[], initial: number): Promise<number> {
	return new Promise((resolve) => {
		let cursor = initial;
		const total = options.length;

		const render = () => {
			process.stdout.write(`\x1b[${total}A`);
			for (let i = 0; i < total; i++) {
				const opt = options[i]!;
				const active = i === cursor;
				const prefix = active ? cyan(">") : " ";
				const text = active ? bold(opt.label) : dim(opt.label);
				process.stdout.write(`\x1b[2K  ${prefix} ${text}\n`);
			}
		};

		process.stdout.write(`  ${bold(title)}\n`);
		for (let i = 0; i < total; i++) {
			const opt = options[i]!;
			const active = i === cursor;
			const prefix = active ? cyan(">") : " ";
			const text = active ? bold(opt.label) : dim(opt.label);
			process.stdout.write(`  ${prefix} ${text}\n`);
		}

		const onData = (data: Buffer) => {
			const key = data.toString();
			if (key === "\x1b[A" || key === "k") {
				cursor = (cursor - 1 + total) % total;
				render();
			} else if (key === "\x1b[B" || key === "j") {
				cursor = (cursor + 1) % total;
				render();
			} else if (key === "\r" || key === "\n") {
				process.stdin.removeListener("data", onData);
				process.stdin.setRawMode?.(false);
				process.stdin.pause();
				render();
				resolve(options[cursor]!.value);
			} else if (key === "\x03") {
				process.stdin.removeListener("data", onData);
				process.stdin.setRawMode?.(false);
				process.stdin.pause();
				resolve(-1);
			}
		};

		process.stdin.setRawMode?.(true);
		process.stdin.resume();
		process.stdin.setEncoding("utf-8");
		process.stdin.on("data", onData);
	});
}

async function interactiveSetPlan(): Promise<void> {
	const config = loadConfig();
	if (!config.plans) config.plans = {};
	const agents = ["claude", "cursor"];

	console.log("");
	console.log(`  ${bold("Configure your plans")}  ${dim("(arrows + enter)")}`);
	console.log("");

	for (const agent of agents) {
		const tiers = KNOWN_PLANS[agent]!;
		const current = config.plans[agent] ?? DEFAULT_PLANS[agent] ?? 0;
		const tierEntries = Object.entries(tiers).filter(([_, price]) => price > 0);

		const options: SelectOption[] = tierEntries.map(([name, price]) => ({
			label: `${name.padEnd(14)} $${price}/mo`,
			value: price,
		}));

		const initialIdx = tierEntries.findIndex(([_, p]) => p === current);

		const picked = await select(
			`${agent.toUpperCase()}`,
			options,
			initialIdx >= 0 ? initialIdx : 0,
		);

		if (picked === -1) {
			console.log(`  ${yellow("cancelled")}`);
			return;
		}

		config.plans[agent] = picked;
		const tierName = tierEntries.find(([_, p]) => p === picked)?.[0] ?? "custom";
		console.log(`  ${green("ok")} ${agent} = ${bold(tierName)} ($${picked}/mo)`);
		console.log("");
	}

	saveConfig(config);
	console.log(`  ${dim("Saved to ~/.skillkit/config.json")}`);
	console.log("");
}

export async function runBurnCommand(): Promise<void> {
	const args = process.argv.slice(3);
	const daysFlag = args.indexOf("--days");
	const days =
		daysFlag >= 0 && args[daysFlag + 1] ? Number(args[daysFlag + 1]) : 30;
	const isJson = args.includes("--json");
	const agentFilter = parseAgentFilter(args);

	if (args.includes("--set-plan")) {
		const setPlanIdx = args.indexOf("--set-plan");
		const agent = args[setPlanIdx + 1];
		const value = args[setPlanIdx + 2];

		if (agent && value) {
			const tierPrice = KNOWN_PLANS[agent]?.[value.toLowerCase()];
			const amount = tierPrice ?? Number(value);
			if (Number.isNaN(amount)) {
				console.error(`  Unknown plan "${value}" for ${agent}.`);
				return;
			}
			const config = loadConfig();
			if (!config.plans) config.plans = {};
			config.plans[agent] = amount;
			saveConfig(config);
			console.log(`  ${green("ok")} ${agent} plan set to ${bold(`$${amount}/mo`)} (saved to ~/.skillkit/config.json)`);
			return;
		}

		await interactiveSetPlan();
		return;
	}

	const config = loadConfig();
	const isTTY = process.stdout.isTTY ?? false;
	if (shouldPromptForPlan(isTTY, Boolean(config.plans), isJson)) {
		console.log(`  ${dim("First run — let's configure your plans.")}`);
		await interactiveSetPlan();
	}

	const results: BurnData[] = [];

	if (!agentFilter || agentFilter === "claude") {
		const claude = scanClaudeBurn(days);
		if (claude.totalApiCalls > 0) results.push(claude);
	}
	if (!agentFilter || agentFilter === "cursor") {
		const cursor = scanCursorBurn(days);
		if (cursor.totalApiCalls > 0) results.push(cursor);
	}

	if (results.length === 0) {
		console.error("  No burn data found.");
		return;
	}

	const analyticsDb = getDb();
	for (const data of results) {
		for (const [, day] of data.dailyMap) {
			upsertDailyUsage(
				analyticsDb,
				day.date,
				data.agent,
				day.inputTokens,
				day.outputTokens,
				day.cacheCreateTokens,
				day.cacheReadTokens,
				day.inputTokens + day.outputTokens + day.cacheCreateTokens + day.cacheReadTokens,
				day.costUsd,
				1,
				[],
				{},
			);
		}
	}

	if (isJson) {
		const output = results.map((d) => ({
			agent: d.agent,
			estimated: d.estimated,
			plan: getAgentPlan(d.agent, args),
			period: {
				days,
				sessions: d.totalSessions,
				api_calls: d.totalApiCalls,
			},
			tokens: {
				input: d.totalInput,
				output: d.totalOutput,
				cache_creation: d.totalCacheCreate,
				cache_read: d.totalCacheRead,
			},
			cost: d.totalCost > 0 ? { total: d.totalCost } : undefined,
			by_day: [...d.dailyMap.values()].sort((a, b) =>
				a.date.localeCompare(b.date),
			),
			by_model: [...d.modelMap.values()].sort(
				(a, b) => b.apiCalls - a.apiCalls,
			),
		}));
		console.log(JSON.stringify(output, null, 2));
		return;
	}

	console.log("");
	console.log(
		`  ${bold("BURN RATE")} ${dim(`— last ${days} days`)}`,
	);

	for (const data of results) {
		const plan = getAgentPlan(data.agent, args);
		console.log("");
		console.log(
			`  ${cyan(data.agent.toUpperCase())} ${data.estimated ? dim("(estimated)") : ""}`,
		);
		console.log("");
		printBurnData(data, plan);
	}

	if (
		!agentFilter ||
		agentFilter === "cursor"
	) {
		printAiContribution();
	}

	if (results.length > 1) {
		const totalCalls = results.reduce(
			(s, d) => s + d.totalApiCalls,
			0,
		);
		const totalCost = results.reduce((s, d) => s + d.totalCost, 0);
		const totalPlan = results.reduce(
			(s, d) => s + getAgentPlan(d.agent, args),
			0,
		);
		console.log(`  ${bold("COMBINED")}`);
		console.log(
			`    Total API calls: ${bold(String(totalCalls))}`,
		);
		if (totalCost > 0) {
			console.log(
				`    Total cost:      ${bold(formatCost(totalCost))}`,
			);
			console.log(
				`    Total plan:      ${dim(`$${totalPlan}/mo`)}`,
			);
		}
		console.log("");
	}

	const claudeData = results.find((d) => d.agent === "claude");
	if (
		claudeData &&
		claudeData.totalCacheCreate + claudeData.totalCacheRead > 0
	) {
		const sonnetPricing = getPricing("claude-sonnet-4");
		const cachePct =
			((claudeData.totalCacheCreate *
				(sonnetPricing.cacheCreate ?? 0) +
				claudeData.totalCacheRead *
					(sonnetPricing.cacheRead ?? 0)) /
				1_000_000 /
				claudeData.totalCost) *
			100;
		if (cachePct > 50) {
			console.log(
				`    ${yellow("!")} Cache is ${cachePct.toFixed(0)}% of your burn. Fewer skills/MCPs = lower cache cost.`,
			);
			console.log("");
		}
	}

	printUnmappedWarning();
}
