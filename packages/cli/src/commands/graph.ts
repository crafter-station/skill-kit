import { getDailyUsageRows } from "../db/queries";
import { getDb } from "../db/schema";
import { parseAgentFilter } from "../tui/args";
import { bold, dim, yellow } from "../tui/colors";
import { renderHeatmap } from "../tui/heatmap";

export function runGraph(): void {
	const db = getDb();
	const args = process.argv.slice(3);
	const agentFilter = parseAgentFilter(args);

	const rows = getDailyUsageRows(db, 365, agentFilter);

	if (rows.length === 0) {
		console.log(`\n  ${yellow("No session data yet.")}`);
		console.log(`  ${dim("Run: skillkit burn  (to index session data)")}\n`);
		return;
	}

	const data = new Map<string, number>();
	for (const row of rows) {
		const existing = data.get(row.date) ?? 0;
		data.set(row.date, existing + row.cost_usd);
	}

	const label = agentFilter ? `${agentFilter} activity` : "all agents";
	console.log(`\n  ${bold("CONTRIBUTION GRAPH")} ${dim(`(${label})`)}\n`);
	console.log(renderHeatmap(data));
}
