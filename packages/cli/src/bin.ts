#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { bold, cyan, dim, yellow } from "./tui/colors";

const pkg = JSON.parse(
	readFileSync(join(dirname(import.meta.dir), "package.json"), "utf-8"),
);
const VERSION: string = pkg.version;

function printHelp(): void {
	console.log(`
  ${bold("skillkit")} ${dim(`v${VERSION}`)} - Analytics for AI agent skills

  ${bold("USAGE")}
    skillkit <command> [args]

  ${bold("COMMANDS")}
    ${cyan("scan")}        Discover installed skills and index session data
    ${cyan("list")}        List installed skills with size & context budget
    ${cyan("stats")}       Usage analytics with sparklines (last 30 days)
    ${cyan("health")}      Health check: unused skills, context budget, DB
    ${cyan("trace")}       Run and record skill execution traces
    ${cyan("conflicts")}   Test skills for trigger collisions
    ${cyan("coverage")}    Analyze dead weight in a skill
    ${cyan("prune")}       Remove unused skills to reclaim context budget
    ${cyan("burn")}        Subscription burn rate analysis (cost, models, daily)
    ${cyan("version")}     Print version
    ${cyan("help")}        Show this help message

  ${bold("FLAGS")}
    ${dim("scan")}  ${cyan("--include-commands")}  Also track slash commands (not just skills)
    ${dim("stats")} ${cyan("--days N")}             Time range in days (default: 30)
    ${dim("stats")} ${cyan("--all")}               Show all skills, not just top 10
    ${dim("trace")} ${cyan("--list")}               List recent traces
    ${dim("trace")} ${cyan("--show <id>")}          Show trace details
    ${dim("trace")} ${cyan("--model <model>")}      Model to use for trace
    ${dim("burn")} ${cyan("--days N")}             Time range in days (default: 30)
    ${dim("burn")} ${cyan("--plan N")}             Monthly plan cost in USD (default: 200)
    ${dim("burn")} ${cyan("--json")}               JSON output
    ${dim("any")}   ${cyan("--claude")}             Only scan Claude Code
    ${dim("any")}   ${cyan("--opencode")}           Only scan OpenCode

  ${dim("Install skills via skills.sh: npx skills add <owner/repo>")}
`);
}

async function main(): Promise<void> {
	const cmd = process.argv[2];

	switch (cmd) {
		case "scan": {
			const { runScan } = await import("./commands/scan");
			await runScan();
			break;
		}
		case "list":
		case "ls": {
			const { runList } = await import("./commands/list");
			runList();
			break;
		}
		case "stats": {
			const { runStats } = await import("./commands/stats");
			await runStats();
			break;
		}
		case "health": {
			const { runHealth } = await import("./commands/health");
			await runHealth();
			break;
		}
		case "trace": {
			const { runTraceCommand } = await import("./commands/trace");
			await runTraceCommand();
			break;
		}
		case "conflicts": {
			const { runConflictsCommand } = await import("./commands/conflicts");
			await runConflictsCommand();
			break;
		}
		case "coverage": {
			const { runCoverageCommand } = await import("./commands/coverage");
			await runCoverageCommand();
			break;
		}
		case "prune": {
			const { runPrune } = await import("./commands/prune");
			await runPrune();
			break;
		}
		case "burn": {
			const { runBurnCommand } = await import("./commands/burn");
			await runBurnCommand();
			break;
		}
		case "version":
		case "--version":
		case "-v": {
			console.log(VERSION);
			break;
		}
		case "help":
		case "--help":
		case "-h":
		case undefined: {
			printHelp();
			break;
		}
		default: {
			console.error(`\n  ${yellow(`Unknown command: ${cmd}`)}`);
			printHelp();
			process.exit(1);
		}
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
