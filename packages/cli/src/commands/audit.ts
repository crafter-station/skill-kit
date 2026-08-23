import { auditSkills, isStrictFailure } from "../audit/analyzer";
import { renderAuditJson, renderAuditReport } from "../audit/report";
import { bold, cyan, dim, red } from "../tui/colors";

export interface AuditCliOptions {
	paths: string[];
	include: string[];
	json: boolean;
	strict: boolean;
	help: boolean;
}

function printAuditHelp(): void {
	console.log(`
  ${bold("skillkit audit")} - Audit a skill or pack against Agent Skills best practices

  ${bold("USAGE")}
    skillkit audit [path ...] [flags]

  ${bold("FLAGS")}
    ${cyan("--include <glob>")}   Include matching skill names or relative paths
    ${cyan("--json")}             Output as JSON
    ${cyan("--strict")}           Exit 1 when warnings or errors are found
    ${cyan("--help")}             Show this help

  ${bold("EXAMPLES")}
    ${dim("skillkit audit ./skills")}
    ${dim("skillkit audit ./skills/testing ./skills/release")}
    ${dim('skillkit audit ./skills --include "rn-*"')}
    ${dim("skillkit audit ./skills --json --strict")}
`);
}

export function parseAuditArgs(args: string[]): AuditCliOptions {
	const options: AuditCliOptions = {
		paths: [],
		include: [],
		json: false,
		strict: false,
		help: false,
	};

	for (let index = 0; index < args.length; index++) {
		const arg = args[index] ?? "";
		if (arg === "--json") options.json = true;
		else if (arg === "--strict") options.strict = true;
		else if (arg === "--help" || arg === "-h") options.help = true;
		else if (arg === "--include") {
			const value = args[index + 1];
			if (!value || value.startsWith("--")) {
				throw new Error("--include requires a glob");
			}
			options.include.push(value);
			index++;
		} else if (arg.startsWith("--include=")) {
			const value = arg.slice("--include=".length);
			if (!value) throw new Error("--include requires a glob");
			options.include.push(value);
		} else if (arg.startsWith("--")) {
			throw new Error(`Unknown flag: ${arg}`);
		} else {
			options.paths.push(arg);
		}
	}

	return options;
}

export async function runAuditCommand(): Promise<void> {
	try {
		const options = parseAuditArgs(process.argv.slice(3));
		if (options.help) {
			printAuditHelp();
			return;
		}
		const result = auditSkills({
			paths: options.paths,
			include: options.include,
		});
		console.log(
			options.json ? renderAuditJson(result) : renderAuditReport(result),
		);
		if (options.strict && isStrictFailure(result)) process.exitCode = 1;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`\n  ${red(message)}\n`);
		process.exitCode = 1;
	}
}
