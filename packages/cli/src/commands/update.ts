import { execSync } from "node:child_process";
import { dim } from "../tui/colors";

export function runUpdate(): void {
	console.log(`\n  ${dim("Checking for updates via skills.sh...")}\n`);
	try {
		execSync("npx -y skills update", { stdio: "inherit" });
	} catch {
		process.exit(1);
	}
}
