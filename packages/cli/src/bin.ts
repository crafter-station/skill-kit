#!/usr/bin/env bun
import { bold, cyan, dim, yellow } from "./tui/colors";

const VERSION = "0.1.0";

function printHelp(): void {
	console.log(`
  ${bold("skill-kit")} ${dim(`v${VERSION}`)} - Analytics & management for AI agent skills

  ${bold("USAGE")}
    skill-kit <command> [args]

  ${bold("MANAGEMENT")} ${dim("(powered by skills.sh)")}
    ${cyan("install")}     Install a skill ${dim("(skill-kit install owner/repo)")}
    ${cyan("uninstall")}   Remove a skill ${dim("(skill-kit uninstall name)")}
    ${cyan("update")}      Update all skills to latest
    ${cyan("find")}        Search the skills.sh registry

  ${bold("ANALYTICS")} ${dim("(local-first)")}
    ${cyan("list")}        List installed skills with size & context budget
    ${cyan("stats")}       Usage analytics with sparklines (last 30 days)
    ${cyan("health")}      Health check: unused skills, context budget, DB
    ${cyan("analyze")}     Scan session files to populate analytics DB

  ${bold("OTHER")}
    ${cyan("version")}     Print version
    ${cyan("help")}        Show this help message
`);
}

async function main(): Promise<void> {
	const cmd = process.argv[2];
	const args = process.argv.slice(3);

	switch (cmd) {
		case "install":
		case "add": {
			const { runInstall } = await import("./commands/install");
			runInstall(args);
			break;
		}
		case "uninstall":
		case "remove": {
			const { runUninstall } = await import("./commands/uninstall");
			runUninstall(args);
			break;
		}
		case "update":
		case "upgrade": {
			const { runUpdate } = await import("./commands/update");
			runUpdate();
			break;
		}
		case "find":
		case "search": {
			const { runFind } = await import("./commands/find");
			runFind(args);
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
