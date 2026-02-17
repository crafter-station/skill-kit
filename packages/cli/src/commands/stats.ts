import { getDailyUsage, getSkillStats, getTopSkills } from "../db/queries";
import { getDb } from "../db/schema";
import { scanAllSessions } from "../scanner/index";
import { bold, cyan, dim, yellow } from "../tui/colors";
import { sparkline } from "../tui/sparkline";

function getMostActiveDay(db: ReturnType<typeof getDb>): string {
	const row = db
		.query<{ day: string; count: number }, []>(
			"SELECT strftime('%w', timestamp) as day, COUNT(*) as count FROM skill_invocations GROUP BY day ORDER BY count DESC LIMIT 1",
		)
		.get();
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

export async function runStats(): Promise<void> {
	const db = getDb();
	console.log("\n  Scanning sessions...");
	const newCount = await scanAllSessions(db);
	if (newCount > 0) {
		console.log(`  Found ${newCount} new invocations.\n`);
	}

	const stats = getSkillStats(db, 30);

	if (stats.total === 0) {
		console.log(`\n  ${yellow("No analytics data yet.")}`);
		console.log(`  ${dim("Run: skillkit scan")}\n`);
		return;
	}

	const topSkills = getTopSkills(db, 30);
	const activeDay = getMostActiveDay(db);

	console.log(`\n  ${bold("SKILL-KIT ANALYTICS")} ${dim("(last 30 days)")}\n`);
	console.log(`  Total invocations: ${bold(String(stats.total))}`);
	console.log(`  Unique skills:     ${bold(String(stats.unique_skills))}`);
	console.log(`  Most active day:   ${bold(activeDay)}\n`);
	console.log(`  ${bold("TOP SKILLS")}\n`);

	const maxCount = topSkills.length > 0 ? (topSkills[0]?.total ?? 1) : 1;
	const barWidth = 20;

	for (const skill of topSkills.slice(0, 10)) {
		const daily = getDailyUsage(db, skill.skill_name, 30);
		const filled = Math.round((skill.total / maxCount) * barWidth);
		const bar = "█".repeat(filled);
		const spark = sparkline(daily.map((d) => d.count));
		const name = cyan(skill.skill_name.padEnd(16));
		console.log(
			`  ${name}  ${bar.padEnd(barWidth)}  ${String(skill.total).padStart(4)}  ${spark}`,
		);
	}

	console.log();
}
