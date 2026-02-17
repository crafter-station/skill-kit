import { execSync } from "node:child_process";
import { dim } from "../tui/colors";

export function runFind(args: string[]): void {
	const query = args.join(" ");
	console.log(`\n  ${dim("Searching skills.sh registry...")}\n`);
	try {
		const cmd = query ? `npx -y skills find ${query}` : "npx -y skills find";
		execSync(cmd, { stdio: "inherit" });
	} catch {
		process.exit(1);
	}
}
