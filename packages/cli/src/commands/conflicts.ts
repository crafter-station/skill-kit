import { getDb } from "../db/schema";
import { analyzeCollision, summarizeConflicts } from "../conflicts/analyzer";
import type { CollisionResult } from "../conflicts/analyzer";
import { discoverAllSkills, findOverlappingPairs } from "../conflicts/discovery";
import { generateProbes } from "../conflicts/probe";
import { renderConflictJson, renderConflictReport } from "../conflicts/report";
import { saveConflictResults } from "../conflicts/store";
import { runTrace } from "../trace/engine";
import { bold, cyan, dim, red, yellow } from "../tui/colors";

function parseModel(args: string[]): string | undefined {
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--model" && args[i + 1]) return args[i + 1];
	}
	return undefined;
}

function parseTimeout(args: string[]): number {
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--timeout" && args[i + 1]) {
			const n = parseInt(args[i + 1]!, 10);
			if (!isNaN(n) && n > 0) return n;
		}
	}
	return 60;
}

function parseThreshold(args: string[]): number {
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--threshold" && args[i + 1]) {
			const n = parseFloat(args[i + 1]!);
			if (!isNaN(n) && n > 0 && n <= 1) return n;
		}
	}
	return 0.3;
}

function printConflictsHelp(): void {
	console.log(`
  ${bold("skillkit conflicts")} - Test skills for trigger collisions

  ${bold("USAGE")}
    skillkit conflicts                Run collision analysis

  ${bold("FLAGS")}
    ${cyan("--model <model>")}        Model to use (default: auto)
    ${cyan("--timeout <sec>")}        Timeout per probe (default: 60)
    ${cyan("--threshold <0-1>")}      Jaccard similarity threshold (default: 0.3)
    ${cyan("--dry-run")}              Show probes without running them
    ${cyan("--json")}                 Output as JSON
    ${cyan("--help")}                 Show this help

  ${bold("EXAMPLES")}
    ${dim("skillkit conflicts")}
    ${dim("skillkit conflicts --threshold 0.2 --dry-run")}
`);
}

export async function runConflictsCommand(): Promise<void> {
	const args = process.argv.slice(3);

	if (args.includes("--help") || args.includes("-h")) {
		printConflictsHelp();
		return;
	}

	const db = getDb();
	const model = parseModel(args);
	const timeout = parseTimeout(args);
	const threshold = parseThreshold(args);
	const dryRun = args.includes("--dry-run");
	const jsonOutput = args.includes("--json");

	console.log(`\n  ${bold("DISCOVERING SKILLS")}...`);

	const projectRoot = process.cwd();
	const skills = discoverAllSkills(projectRoot);

	if (skills.length === 0) {
		console.log(`\n  ${yellow("No skills found.")}`);
		console.log(`  ${dim("Skills are discovered from ~/.claude/skills/ and .claude/skills/")}\n`);
		return;
	}

	console.log(`  Found ${bold(String(skills.length))} skills`);
	for (const s of skills) {
		console.log(`    ${dim(s.scope === "global" ? "G" : "P")} ${cyan(s.name)} ${dim(`— ${s.description.slice(0, 60)}...`)}`);
	}

	const pairs = findOverlappingPairs(skills, threshold);
	console.log(`\n  ${bold("OVERLAPPING PAIRS")}: ${pairs.length} (threshold: ${threshold})`);

	for (const p of pairs) {
		console.log(`    ${cyan(p.a.name)} ↔ ${cyan(p.b.name)} ${dim(`(${(p.similarity * 100).toFixed(0)}%)`)}`);
	}

	const probes = generateProbes(skills, pairs);
	console.log(`\n  ${bold("PROBES GENERATED")}: ${probes.length}`);

	if (dryRun) {
		console.log("");
		for (const p of probes) {
			const type = p.type === "ambiguous" ? yellow("AMB") : dim("CLR");
			console.log(`  ${type} ${dim(`→ ${p.expectedSkill}`)}: "${p.prompt}"`);
		}
		console.log("");
		return;
	}

	console.log(`  ${dim(`model: ${model ?? "auto"}  timeout: ${timeout}s`)}\n`);

	const results: CollisionResult[] = [];

	for (let i = 0; i < probes.length; i++) {
		const probe = probes[i]!;
		const label = `  ${dim(`[${i + 1}/${probes.length}]`)} ${probe.prompt.slice(0, 50)}`;
		process.stdout.write(`${label} `);

		try {
			const trace = await runTrace({
				prompt: probe.prompt,
				model,
				timeout,
			});

			const result = analyzeCollision(probe, trace);
			results.push(result);

			const icon = result.matched ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
			const fired = trace.skillName ?? "(none)";
			console.log(`${icon} ${dim(`fired: ${fired}`)}`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.log(`${red("✗")} ${dim(msg)}`);
		}
	}

	const summary = summarizeConflicts(results, skills.length);

	if (results.length > 0) {
		saveConflictResults(db, results);
	}

	if (jsonOutput) {
		console.log(renderConflictJson(summary));
	} else {
		console.log(renderConflictReport(summary));
	}
}
