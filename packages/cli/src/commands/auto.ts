import {
	getHookCommand,
	installHook,
	isHookInstalled,
	removeHook,
} from "../lib/hooks";
import { bold, cyan, dim, green, red } from "../tui/colors";

export function runAuto(): void {
	const args = process.argv.slice(3);

	if (args.includes("--remove") || args.includes("--off")) {
		const removed = removeHook();
		if (removed) {
			console.log(
				`\n  ${green("ok")} SessionEnd hook removed from ~/.claude/settings.json\n`,
			);
		} else {
			console.log(`\n  ${dim("No hook found to remove.")}\n`);
		}
		return;
	}

	if (args.includes("--install") || args.includes("--on")) {
		const installed = installHook();
		if (installed) {
			console.log(`\n  ${green("ok")} SessionEnd hook installed`);
			console.log(
				`  ${dim("skillkit scan runs after every Claude Code session")}\n`,
			);
		} else {
			console.log(`\n  ${dim("Hook already installed.")}\n`);
		}
		return;
	}

	const installed = isHookInstalled();
	console.log(`\n  ${bold("AUTO-SCAN")}\n`);
	console.log(
		`  Claude Code hook: ${installed ? green("active") : red("inactive")}`,
	);
	console.log(`  Command:          ${dim(getHookCommand())}`);
	console.log(`  Trigger:          ${dim("SessionEnd (async)")}\n`);

	if (!installed) {
		console.log(`  ${cyan("skillkit auto --on")}   Install SessionEnd hook`);
	} else {
		console.log(`  ${cyan("skillkit auto --off")}  Remove SessionEnd hook`);
	}
	console.log();
}
