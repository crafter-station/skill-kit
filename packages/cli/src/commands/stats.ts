import {
	getCurrentStreak,
	getDailyUsage,
	getInstalledSkills,
	getSkillStats,
	getTopSkills,
	getWeeklyVelocity,
} from "../db/queries";
import { getDb } from "../db/schema";
import { performScan } from "../scanner/auto-scan";
import { parseAgentFilter } from "../tui/args";
import { bold, cyan, dim, green, red, yellow } from "../tui/colors";
import { sparkline } from "../tui/sparkline";

function getMostActiveDay(
	db: ReturnType<typeof getDb>,
	agent?: string,
): string {
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
		const next = args[i + 1];
		if (args[i] === "--days" && next) {
			const n = parseInt(next, 10);
			if (!Number.isNaN(n) && n > 0) return n;
		}
		const match = args[i]?.match(/^--days=(\d+)$/);
		const matchedDays = match?.[1];
		if (matchedDays) {
			const n = parseInt(matchedDays, 10);
			if (!Number.isNaN(n) && n > 0) return n;
		}
	}
	return 30;
}

export function getStatsJson(
	db: ReturnType<typeof getDb>,
	days = 30,
	agentFilter?: string,
) {
	const stats = getSkillStats(db, days, agentFilter);
	if (stats.total === 0) return { error: "no_data", total: 0 };
	const topSkills = getTopSkills(db, days, undefined, agentFilter);
	const streak = getCurrentStreak(db, agentFilter);
	const velocity = getWeeklyVelocity(db, agentFilter);
	return {
		period: { days },
		total_invocations: stats.total,
		unique_skills: stats.unique_skills,
		most_active_day: getMostActiveDay(db, agentFilter),
		streak: { current: streak.current, longest: streak.longest },
		velocity: {
			this_week: velocity.thisWeek,
			last_week: velocity.lastWeek,
			change_pct: velocity.change,
		},
		top_skills: topSkills.map((skill) => ({
			name: skill.skill_name,
			total: skill.total,
			daily: getDailyUsage(db, skill.skill_name, days, agentFilter).map(
				(day) => ({
					date: day.date,
					count: day.count,
				}),
			),
		})),
	};
}

export async function runStats(): Promise<void> {
	const db = getDb();
	const args = process.argv.slice(3);
	const days = parseDays(args);
	const agentFilter = parseAgentFilter(args);
	const isJson = args.includes("--json");

	const installedSkills = getInstalledSkills(db);

	if (installedSkills.length === 0) {
		if (!isJson) console.log("\n  First run detected, scanning skills...");
		const result = await performScan(db, { agentFilter, quiet: isJson });
		if (result.skillCount > 0) {
			if (!isJson) console.log(`  Found ${result.skillCount} skills.\n`);
		} else {
			if (isJson) {
				console.log(JSON.stringify({ error: "no_skills_found" }));
			} else {
				console.log(`\n  ${yellow("No skills found.")}`);
				console.log(
					`  ${dim("Skills will be scanned automatically on next run.")}\n`,
				);
			}
			return;
		}
	} else {
		if (!isJson) console.log("\n  Scanning sessions...");
		const refresh = await performScan(db, {
			agentFilter,
			includeCommands: true,
			quiet: isJson,
		});
		if (refresh.invocationCount > 0 && !isJson) {
			console.log(`  Found ${refresh.invocationCount} new invocations.\n`);
		}
	}

	const stats = getSkillStats(db, days, agentFilter);

	if (stats.total === 0) {
		if (isJson) {
			console.log(JSON.stringify({ error: "no_data", total: 0 }));
		} else {
			console.log(`\n  ${yellow("No analytics data yet.")}`);
			console.log(`  ${dim("Run: skillkit scan")}\n`);
		}
		return;
	}

	const showAll = process.argv.includes("--all");
	const topSkills = getTopSkills(
		db,
		days,
		showAll ? undefined : 10,
		agentFilter,
	);
	const activeDay = getMostActiveDay(db, agentFilter);

	if (isJson) {
		console.log(JSON.stringify(getStatsJson(db, days, agentFilter), null, 2));
		return;
	}

	const label =
		days === 30
			? "last 30 days"
			: days === 7
				? "last 7 days"
				: `last ${days} days`;

	console.log(`\n  ${bold("SKILL-KIT ANALYTICS")} ${dim(`(${label})`)}\n`);
	console.log(`  Total invocations: ${bold(String(stats.total))}`);
	console.log(`  Unique skills:     ${bold(String(stats.unique_skills))}`);
	console.log(`  Most active day:   ${bold(activeDay)}\n`);

	const streak = getCurrentStreak(db, agentFilter);
	const velocity = getWeeklyVelocity(db, agentFilter);

	if (streak.current > 0) {
		console.log(
			`  Current streak:    ${bold(`${streak.current} days`)} ${streak.current >= 7 ? "🔥" : ""}`,
		);
		console.log(`  Longest streak:    ${bold(`${streak.longest} days`)}`);
	}

	if (velocity.thisWeek > 0) {
		const changeStr =
			velocity.change > 0
				? green(`+${velocity.change.toFixed(0)}%`)
				: velocity.change < 0
					? red(`${velocity.change.toFixed(0)}%`)
					: dim("—");
		console.log(
			`  This week:         ${bold(`$${velocity.thisWeek.toFixed(2)}`)} ${dim("vs last")} $${velocity.lastWeek.toFixed(2)} (${changeStr})`,
		);
	}

	if (streak.current > 0 || velocity.thisWeek > 0) console.log();

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
