import {
	getDailyUsage,
	getInstalledSkills,
	getSkillStats,
	getTopSkills,
} from "../db/queries";
import { getDb } from "../db/schema";
import { performScan } from "../scanner/auto-scan";
import { scanAllSessions } from "../scanner/index";
import { bold, cyan, dim, yellow } from "../tui/colors";
import { sparkline } from "../tui/sparkline";

function getMostActiveDay(db: ReturnType<typeof getDb>, agent?: string): string {
	const agentClause = agent ? " WHERE agent = ?" : "";
	const params = agent ? [agent] : [];
	const row = db
		.query<{ day: string; count: number }, string[]>(
			`SELECT strftime('%w', timestamp) as day, COUNT(*) as count FROM skill_invocations${agentClause} GROUP BY day ORDER BY count DESC LIMIT 1`,
		)
		.get(...params);
	if (!row) return "N/A";
	const days = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	];
	return days[parseInt(row.day, 10)] ?? "N/A";
}

function parseDays(args: string[]): number {
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--days" && args[i + 1]) {
			const n = parseInt(args[i + 1], 10);
			if (!isNaN(n) && n > 0) return n;
		}
		const match = args[i]?.match(/^--days=(\d+)$/);
		if (match) {
			const n = parseInt(match[1], 10);
			if (!isNaN(n) && n > 0) return n;
		}
	}
	return 30;
}

function parseAgentFilter(args: string[]): string | undefined {
	if (args.includes("--claude")) return "claude";
	if (args.includes("--opencode")) return "opencode";
	return undefined;
}

export async function runStats(): Promise<void> {
	const db = getDb();
	const args = process.argv.slice(3);
	const days = parseDays(args);
	const agentFilter = parseAgentFilter(args);

	const installedSkills = getInstalledSkills(db);

	if (installedSkills.length === 0) {
		console.log("\n  First run detected, scanning skills...");
		const result = await performScan(db, { agentFilter });
		if (result.skillCount > 0) {
			console.log(`  Found ${result.skillCount} skills.\n`);
		} else {
			console.log(`\n  ${yellow("No skills found.")}`);
			console.log(`  ${dim("Skills will be scanned automatically on next run.")}\n`);
			return;
		}
	} else {
		console.log("\n  Scanning sessions...");
		const newCount = await scanAllSessions(db, new Set(), agentFilter);
		if (newCount > 0) {
			console.log(`  Found ${newCount} new invocations.\n`);
		}
	}

	const stats = getSkillStats(db, days, agentFilter);

	if (stats.total === 0) {
		console.log(`\n  ${yellow("No analytics data yet.")}`);
		console.log(`  ${dim("Run: skillkit scan")}\n`);
		return;
	}

	const showAll = process.argv.includes("--all");
	const topSkills = getTopSkills(db, days, showAll ? undefined : 10, agentFilter);
	const activeDay = getMostActiveDay(db, agentFilter);

	const label =
		days === 30 ? "last 30 days" : days === 7 ? "last 7 days" : `last ${days} days`;

	console.log(`\n  ${bold("SKILL-KIT ANALYTICS")} ${dim(`(${label})`)}\n`);
	console.log(`  Total invocations: ${bold(String(stats.total))}`);
	console.log(`  Unique skills:     ${bold(String(stats.unique_skills))}`);
	console.log(`  Most active day:   ${bold(activeDay)}\n`);
	console.log(`  ${bold(showAll ? "ALL SKILLS" : "TOP SKILLS")}\n`);

	const maxCount = topSkills.length > 0 ? (topSkills[0]?.total ?? 1) : 1;
	const maxNameLen = Math.max(16, ...topSkills.map((s) => s.skill_name.length));
	const barWidth = 20;

	for (const skill of topSkills) {
		const daily = getDailyUsage(db, skill.skill_name, days, agentFilter);
		const filled = Math.round((skill.total / maxCount) * barWidth);
		const bar = "█".repeat(filled);
		const spark = sparkline(daily.map((d) => d.count));
		const name = cyan(skill.skill_name.padEnd(maxNameLen));
		console.log(
			`  ${name}  ${bar.padEnd(barWidth)}  ${String(skill.total).padStart(4)}  ${spark}`,
		);
	}

	console.log();
}
