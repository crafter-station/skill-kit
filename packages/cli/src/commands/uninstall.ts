import { execSync } from "node:child_process";
import { dim, yellow } from "../tui/colors";

export function runUninstall(args: string[]): void {
	const name = args.join(" ");
	if (!name) {
		console.error(`\n  ${yellow("Usage:")} skill-kit uninstall <skill-name>\n`);
		process.exit(1);
	}
	console.log(`\n  ${dim("Removing via skills.sh...")}\n`);
	try {
		execSync(`npx -y skills remove ${name}`, { stdio: "inherit" });
	} catch {
		process.exit(1);
	}
}
