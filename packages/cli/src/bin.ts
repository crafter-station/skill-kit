#!/usr/bin/env bun
import { bold, cyan, dim, yellow } from "./tui/colors";

const VERSION = "0.0.1";

function printHelp(): void {
	console.log(`
  ${bold("skill-kit")} ${dim(`v${VERSION}`)} - Claude skill analytics & management

  ${bold("USAGE")}
    skill-kit <command>

  ${bold("COMMANDS")}
    ${cyan("list")}      List all installed skills
    ${cyan("stats")}     Show usage analytics (last 30 days)
    ${cyan("health")}    Run a health check on your skill setup
    ${cyan("analyze")}   Scan sessions and populate analytics DB
    ${cyan("version")}   Print version
    ${cyan("help")}      Show this help message
`);
}

async function main(): Promise<void> {
	const cmd = process.argv[2];

	switch (cmd) {
		case "list": {
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
		case "analyze": {
			const { getDb } = await import("./db/schema");
			const { scanAllSessions } = await import("./scanner/index");
			const db = getDb();
			console.log("\n  Scanning ~/.claude/projects/ for skill invocations...");
			const count = await scanAllSessions(db);
			console.log(
				`  ${count > 0 ? `Found ${count} new invocations.` : "No new invocations found."}\n`,
			);
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
