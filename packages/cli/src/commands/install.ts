import { execSync } from "node:child_process";
import { bold, dim, yellow } from "../tui/colors";

export function runInstall(args: string[]): void {
	const source = args.join(" ");
	if (!source) {
		console.error(`\n  ${yellow("Usage:")} skill-kit install <owner/repo>\n`);
		console.log(`  ${dim("Examples:")}`);
		console.log(`    skill-kit install vercel-labs/agent-skills`);
		console.log(`    skill-kit install crafter-station/skill-kit\n`);
		process.exit(1);
	}
	console.log(
		`\n  ${dim("Installing via")} ${bold("skills.sh")}${dim("...")}\n`,
	);
	try {
		execSync(`npx -y skills add ${source}`, { stdio: "inherit" });
	} catch {
		process.exit(1);
	}
}
