import {
	BUNDLED_SKILLS,
	getBundledSkill,
	renderBundledSkill,
} from "../skills/catalog";
import { bold, cyan, dim, red } from "../tui/colors";

export interface SkillsCliOptions {
	action: "get" | "help" | "list";
	name?: string;
	full: boolean;
	json: boolean;
}

function printSkillsHelp(): void {
	console.log(`
  ${bold("skillkit skills")} - Load version-matched skillkit guidance

  ${bold("USAGE")}
    skillkit skills list
    skillkit skills get <name> [--full]

  ${bold("FLAGS")}
    ${cyan("--full")}   Include supporting references
    ${cyan("--json")}   Output as JSON
    ${cyan("--help")}   Show this help

  ${bold("START HERE")}
    ${dim("skillkit skills get core")}
    ${dim("skillkit skills get core --full")}
`);
}

export function parseSkillsArgs(args: string[]): SkillsCliOptions {
	const full = args.includes("--full");
	const json = args.includes("--json");
	const positional = args.filter((arg) => !arg.startsWith("--"));
	const action = positional[0];

	for (const arg of args.filter((value) => value.startsWith("--"))) {
		if (!["--full", "--help", "--json", "-h"].includes(arg)) {
			throw new Error(`Unknown flag: ${arg}`);
		}
	}

	if (args.includes("--help") || args.includes("-h")) {
		return { action: "help", full, json };
	}
	if (!action || action === "list") return { action: "list", full, json };
	if (action === "get") {
		const name = positional[1];
		if (!name)
			throw new Error(
				"No skill name provided. Usage: skillkit skills get <name>",
			);
		if (positional.length > 2)
			throw new Error(`Unexpected argument: ${positional[2]}`);
		return { action: "get", name, full, json };
	}
	throw new Error(`Unknown skills action: ${action}`);
}

export async function runSkillsCommand(): Promise<void> {
	try {
		const options = parseSkillsArgs(process.argv.slice(3));
		if (options.action === "help") {
			printSkillsHelp();
			return;
		}
		if (options.action === "list") {
			if (options.json) {
				console.log(
					JSON.stringify(
						BUNDLED_SKILLS.map(({ name, description, version }) => ({
							name,
							description,
							version,
						})),
						null,
						2,
					),
				);
				return;
			}
			console.log(`\n  ${bold("BUNDLED SKILLS")}\n`);
			for (const skill of BUNDLED_SKILLS) {
				console.log(`  ${cyan(skill.name)} ${dim(`v${skill.version}`)}`);
				console.log(`    ${skill.description}`);
			}
			console.log();
			return;
		}

		const skill = getBundledSkill(options.name ?? "");
		if (!skill) {
			throw new Error(
				`Unknown bundled skill: ${options.name}. Run: skillkit skills list`,
			);
		}
		const content = renderBundledSkill(skill, options.full);
		if (options.json) {
			console.log(
				JSON.stringify(
					{
						name: skill.name,
						version: skill.version,
						full: options.full,
						content,
					},
					null,
					2,
				),
			);
			return;
		}
		process.stdout.write(content);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`\n  ${red(message)}\n`);
		process.exitCode = 1;
	}
}
