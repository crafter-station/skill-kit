import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { bold, cyan, dim, green, red, yellow } from "../tui/colors";

const MODEL_PRICING: Record<string, { input: number; output: number; cacheCreate: number; cacheRead: number }> = {
	"claude-opus-4": { input: 15, output: 75, cacheCreate: 18.75, cacheRead: 1.5 },
	"claude-sonnet-4": { input: 3, output: 15, cacheCreate: 3.75, cacheRead: 0.30 },
	"claude-haiku-4": { input: 0.8, output: 4, cacheCreate: 1, cacheRead: 0.08 },
};

function getPricing(model: string) {
	for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
		if (model.includes(key)) return pricing;
	}
	return MODEL_PRICING["claude-sonnet-4"]!;
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

function sparkbar(values: number[], width = 20): string {
	const max = Math.max(...values, 1);
	return values.map((v) => {
		const filled = Math.round((v / max) * width);
		return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
	}).join("\n");
}

export async function runBurnCommand(): Promise<void> {
	const args = process.argv.slice(3);
	const daysFlag = args.indexOf("--days");
	const days = daysFlag >= 0 && args[daysFlag + 1] ? Number(args[daysFlag + 1]) : 30;
	const planFlag = args.indexOf("--plan");
	const plan = planFlag >= 0 && args[planFlag + 1] ? Number(args[planFlag + 1]) : 200;
	const isJson = args.includes("--json");

	const projectsDir = join(homedir(), ".claude", "projects");
	if (!existsSync(projectsDir)) {
		console.error("  No Claude Code sessions found.");
		return;
	}

	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - days);
	const cutoffTs = cutoff.getTime();

	const dailyMap = new Map<string, DayBurn>();
	const modelMap = new Map<string, ModelBurn>();
	let totalSessions = 0;
	let totalApiCalls = 0;
	let totalInput = 0;
	let totalOutput = 0;
	let totalCacheCreate = 0;
	let totalCacheRead = 0;
	let totalCost = 0;

	const glob = new Bun.Glob("**/*.jsonl");
	for await (const file of glob.scan({ cwd: projectsDir, absolute: true })) {
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
			const cacheCreateTok = (usage.cache_creation_input_tokens as number) ?? 0;
			const cacheReadTok = (usage.cache_read_input_tokens as number) ?? 0;

			const model = (msg.model as string) ?? "unknown";
			const pricing = getPricing(model);
			const cost =
				(inputTok * pricing.input +
				outputTok * pricing.output +
				cacheCreateTok * pricing.cacheCreate +
				cacheReadTok * pricing.cacheRead) / 1_000_000;

			const ts = (obj.timestamp as string) ?? "";
			const date = ts.slice(0, 10);

			if (!dailyMap.has(date)) {
				dailyMap.set(date, { date, sessions: 0, apiCalls: 0, inputTokens: 0, outputTokens: 0, cacheCreateTokens: 0, cacheReadTokens: 0, costUsd: 0 });
			}
			const day = dailyMap.get(date)!;
			day.apiCalls++;
			day.inputTokens += inputTok;
			day.outputTokens += outputTok;
			day.cacheCreateTokens += cacheCreateTok;
			day.cacheReadTokens += cacheReadTok;
			day.costUsd += cost;

			const modelKey = model.replace(/-\d{8}$/, "");
			if (!modelMap.has(modelKey)) {
				modelMap.set(modelKey, { model: modelKey, apiCalls: 0, costUsd: 0 });
			}
			const m = modelMap.get(modelKey)!;
			m.apiCalls++;
			m.costUsd += cost;

			totalApiCalls++;
			totalInput += inputTok;
			totalOutput += outputTok;
			totalCacheCreate += cacheCreateTok;
			totalCacheRead += cacheReadTok;
			totalCost += cost;
			sessionHasData = true;
		}

		if (sessionHasData) totalSessions++;
	}

	const sortedDays = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
	const daysElapsed = sortedDays.length || 1;
	const dailyAvg = totalCost / daysElapsed;
	const projected = dailyAvg * 31;
	const utilization = (totalCost / plan) * 100;

	if (isJson) {
		console.log(JSON.stringify({
			period: { days, sessions: totalSessions, api_calls: totalApiCalls },
			tokens: { input: totalInput, output: totalOutput, cache_creation: totalCacheCreate, cache_read: totalCacheRead },
			cost: { total: totalCost, daily_avg: dailyAvg, projected_monthly: projected, plan, utilization_pct: utilization },
			by_day: sortedDays,
			by_model: [...modelMap.values()].sort((a, b) => b.costUsd - a.costUsd),
		}, null, 2));
		return;
	}

	console.log("");
	console.log(`  ${bold("BURN RATE")} ${dim(`— last ${days} days`)}`);
	console.log("");

	console.log(`    Sessions:     ${bold(String(totalSessions))}`);
	console.log(`    API calls:    ${bold(String(totalApiCalls))}`);
	console.log("");

	console.log(`    ${bold("TOKENS")}`);
	console.log(`    Input:        ${formatTokens(totalInput)}`);
	console.log(`    Output:       ${formatTokens(totalOutput)}`);
	console.log(`    Cache create: ${formatTokens(totalCacheCreate)}`);
	console.log(`    Cache read:   ${formatTokens(totalCacheRead)}`);
	console.log("");

	console.log(`    ${bold("COST")}`);
	console.log(`    Total:        ${bold(formatCost(totalCost))}`);
	console.log(`    Daily avg:    ${formatCost(dailyAvg)}`);
	console.log(`    Projected/mo: ${formatCost(projected)}`);
	console.log(`    Plan:         ${dim(`$${plan}/mo`)}`);

	const utilizationColor = utilization > 100 ? red : utilization > 80 ? yellow : green;
	console.log(`    Utilization:  ${utilizationColor(`${utilization.toFixed(0)}%`)}`);
	console.log("");

	const sortedModels = [...modelMap.values()].sort((a, b) => b.costUsd - a.costUsd);
	if (sortedModels.length > 0) {
		console.log(`    ${bold("BY MODEL")}`);
		const maxModelCost = Math.max(...sortedModels.map((m) => m.costUsd));
		for (const m of sortedModels) {
			const barLen = Math.round((m.costUsd / maxModelCost) * 15);
			const bar = "█".repeat(barLen) + "░".repeat(15 - barLen);
			const name = m.model.padEnd(28);
			console.log(`    ${dim(name)} ${cyan(bar)} ${formatCost(m.costUsd)} ${dim(`(${m.apiCalls} calls)`)}`);
		}
		console.log("");
	}

	if (sortedDays.length > 1) {
		console.log(`    ${bold("DAILY BURN")}`);
		const maxDayCost = Math.max(...sortedDays.map((d) => d.costUsd));
		const recentDays = sortedDays.slice(-14);
		for (const d of recentDays) {
			const barLen = Math.round((d.costUsd / maxDayCost) * 20);
			const bar = "█".repeat(barLen) + "░".repeat(20 - barLen);
			const weekday = new Date(d.date + "T12:00:00").toLocaleDateString("en", { weekday: "short" }).slice(0, 3);
			console.log(`    ${dim(d.date)} ${dim(weekday)} ${cyan(bar)} ${formatCost(d.costUsd)}`);
		}
		console.log("");
	}

	if (totalCacheCreate + totalCacheRead > 0) {
		const cachePct = ((totalCacheCreate * getPricing("sonnet")!.cacheCreate + totalCacheRead * getPricing("sonnet")!.cacheRead) / 1_000_000 / totalCost * 100);
		if (cachePct > 50) {
			console.log(`    ${yellow("!")} Cache is ${cachePct.toFixed(0)}% of your burn. Fewer skills/MCPs = lower cache cost.`);
			console.log("");
		}
	}
}
