import { getDailyUsageRows } from "../db/queries";
import { getDb } from "../db/schema";
import { parseAgentFilter } from "../tui/args";
import { bold, cyan, dim, green, red, yellow } from "../tui/colors";

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

const AGENT_COLORS: Record<string, (s: string) => string> = {
	claude: cyan,
	cursor: yellow,
	codex: green,
	gemini: (s: string) => `\x1b[34m${s}\x1b[0m`,
	windsurf: (s: string) => `\x1b[35m${s}\x1b[0m`,
	opencode: (s: string) => `\x1b[38;5;208m${s}\x1b[0m`,
};

function agentColor(agent: string): (s: string) => string {
	return AGENT_COLORS[agent] ?? dim;
}

function parseDays(args: string[]): number {
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--days" && args[i + 1]) {
			const n = parseInt(args[i + 1]!, 10);
			if (!isNaN(n) && n > 0) return n;
		}
	}
	return 30;
}

export function runSessions(): void {
	const db = getDb();
	const args = process.argv.slice(3);
	const days = parseDays(args);
	const agentFilter = parseAgentFilter(args);
	const isJson = args.includes("--json");

	const rows = getDailyUsageRows(db, days, agentFilter);

	if (rows.length === 0) {
		if (isJson) {
			console.log(JSON.stringify({ error: "no_data" }));
		} else {
			console.log(`\n  ${yellow("No session data yet.")}`);
			console.log(`  ${dim("Run: skillkit burn  (to index session data)")}\n`);
		}
		return;
	}

	if (isJson) {
		console.log(JSON.stringify(rows, null, 2));
		return;
	}

	const label = days === 30 ? "last 30 days" : days === 7 ? "last 7 days" : `last ${days} days`;
	console.log(`\n  ${bold("SESSIONS")} ${dim(`(${label})`)}\n`);

	let totalCost = 0;
	let totalInput = 0;
	let totalOutput = 0;

	const byDate = new Map<string, typeof rows>();
	for (const row of rows) {
		const existing = byDate.get(row.date) ?? [];
		existing.push(row);
		byDate.set(row.date, existing);
		totalCost += row.cost_usd;
		totalInput += row.input_tokens;
		totalOutput += row.output_tokens;
	}

	console.log(`  Total: ${bold(formatCost(totalCost))}  ${dim("in")} ${formatTokens(totalInput)} ${dim("/")} ${formatTokens(totalOutput)} ${dim("tokens (in/out)")}\n`);

	const sortedDates = [...byDate.keys()].sort().reverse();

	for (const date of sortedDates) {
		const dayRows = byDate.get(date)!;
		const weekday = new Date(date + "T12:00:00")
			.toLocaleDateString("en", { weekday: "short" })
			.slice(0, 3);

		const dayCost = dayRows.reduce((s, r) => s + r.cost_usd, 0);
		const dayIn = dayRows.reduce((s, r) => s + r.input_tokens, 0);
		const dayOut = dayRows.reduce((s, r) => s + r.output_tokens, 0);

		const agents = dayRows.map((r) => {
			const color = agentColor(r.agent);
			return color(r.agent);
		}).join(dim(" + "));

		console.log(
			`  ${dim(date)} ${dim(weekday)}  ${bold(formatCost(dayCost).padStart(8))}  ${formatTokens(dayIn)} ${dim("/")} ${formatTokens(dayOut)}  ${agents}`,
		);
	}

	console.log();
}
