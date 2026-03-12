import { resolve } from "node:path";
import { getDb } from "../db/schema";
import { parseSkillDirectory } from "../coverage/parser";
import { analyzeCoverage } from "../coverage/scanner";
import { renderCoverageJson, renderCoverageReport } from "../coverage/report";
import { bold, cyan, dim, red, yellow } from "../tui/colors";

function printCoverageHelp(): void {
	console.log(`
  ${bold("skillkit coverage")} - Analyze dead weight in a skill

  ${bold("USAGE")}
    skillkit coverage <skill-path>     Analyze a skill directory

  ${bold("FLAGS")}
    ${cyan("--json")}              Output as JSON
    ${cyan("--help")}              Show this help

  ${bold("EXAMPLES")}
    ${dim("skillkit coverage ./skills/commit/")}
    ${dim("skillkit coverage ~/.claude/skills/v0-build/")}
    ${dim("skillkit coverage ./skills/commit/ --json")}
`);
}

export async function runCoverageCommand(): Promise<void> {
	const args = process.argv.slice(3);

	if (args.includes("--help") || args.includes("-h")) {
		printCoverageHelp();
		return;
	}

	const skillPath = args.find((a) => !a.startsWith("--"));
	if (!skillPath) {
		printCoverageHelp();
		return;
	}

	const jsonOutput = args.includes("--json");
	const resolvedPath = resolve(skillPath);

	console.log(`\n  ${bold("ANALYZING")} ${cyan(resolvedPath)}...\n`);

	try {
		const skill = parseSkillDirectory(resolvedPath);
		const db = getDb();
		const result = analyzeCoverage(skill, db);

		if (jsonOutput) {
			console.log(renderCoverageJson(result));
		} else {
			console.log(renderCoverageReport(result));
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`\n  ${red(msg)}\n`);
		process.exit(1);
	}
}
