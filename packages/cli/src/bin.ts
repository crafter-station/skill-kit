#!/usr/bin/env bun
import { bold, cyan, dim, yellow } from "./tui/colors";

const VERSION = "0.1.5";

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
    ${cyan("prune")}       Remove unused skills to reclaim context budget
    ${cyan("version")}     Print version
    ${cyan("help")}        Show this help message

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
		case "prune": {
			const { runPrune } = await import("./commands/prune");
			await runPrune();
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
