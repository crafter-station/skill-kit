import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getDb } from "../db/schema";
import { aggregateBenchmark, compareBenchmarks } from "../eval/benchmark";
import type { EvalGrade } from "../eval/grader";
import { gradeExpectations } from "../eval/grader";
import { generateEvalSuite, loadEvalSuite, resolveEvalsPath } from "../eval/loader";
import {
	renderBenchmarkJson,
	renderBenchmarkTable,
	renderComparisonTable,
	renderEvalResults,
} from "../eval/report";
import { saveBenchmark } from "../eval/store";
import { runTrace } from "../trace/engine";
import { saveTrace } from "../trace/store";
import { bold, cyan, dim, green, red, yellow } from "../tui/colors";

function parseModel(args: string[]): string | undefined {
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--model" && args[i + 1]) return args[i + 1];
		const match = args[i]?.match(/^--model=(.+)$/);
		if (match) return match[1];
	}
	return undefined;
}

function parseSuite(args: string[]): string | undefined {
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--suite" && args[i + 1]) return args[i + 1];
		const match = args[i]?.match(/^--suite=(.+)$/);
		if (match) return match[1];
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
	return 120;
}

function extractPositional(args: string[]): string[] {
	const flags = new Set(["--model", "--suite", "--timeout", "--compare", "--init-model"]);
	const positional: string[] = [];
	for (let i = 0; i < args.length; i++) {
		if (flags.has(args[i] ?? "")) {
			i++;
			continue;
		}
		if (args[i]?.startsWith("--")) continue;
		positional.push(args[i]!);
	}
	return positional;
}

function printTestHelp(): void {
	console.log(`
  ${bold("skillkit test")} - Run eval suite against a skill

  ${bold("USAGE")}
    skillkit test <skill-path>                      Run evals
    skillkit test <skill-path> --compare <other>    Compare two skills
    skillkit test <skill-path> --baseline           Compare skill vs no-skill
    skillkit test --init <skill-path>               Auto-generate evals.json

  ${bold("FLAGS")}
    ${cyan("--suite <path>")}      Path to evals.json (default: auto-detect)
    ${cyan("--model <model>")}     Model to use (default: auto)
    ${cyan("--timeout <sec>")}     Timeout per eval (default: 120)
    ${cyan("--compare <path>")}    Compare against another skill version
    ${cyan("--baseline")}          Run with and without skill, show delta
    ${cyan("--init")}              Generate evals.json from SKILL.md
    ${cyan("--init-model <m>")}    Model for --init generation (default: claude-haiku-4-5)
    ${cyan("--json")}              Output as JSON
    ${cyan("--help")}              Show this help

  ${bold("EXAMPLES")}
    ${dim("skillkit test ./skills/commit/")}
    ${dim("skillkit test ./skills/commit/ --suite ./evals/evals.json")}
    ${dim("skillkit test ./skills/commit-v1/ --compare ./skills/commit-v2/")}
    ${dim("skillkit test ./skills/commit/ --baseline")}
    ${dim("skillkit test --init ./skills/commit/")}
`);
}

function parseInitModel(args: string[]): string {
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--init-model" && args[i + 1]) return args[i + 1]!;
	}
	return "claude-haiku-4-5";
}

export async function runTestCommand(): Promise<void> {
	const args = process.argv.slice(3);

	if (args.includes("--help") || args.includes("-h")) {
		printTestHelp();
		return;
	}

	const positional = extractPositional(args);
	const skillPath = positional[0];

	if (!skillPath) {
		printTestHelp();
		return;
	}

	const resolvedSkillPath = resolve(skillPath);

	if (args.includes("--init")) {
		const skillMdPath = resolve(resolvedSkillPath, "SKILL.md");
		if (!existsSync(skillMdPath)) {
			console.error(`  ${red("ERROR")} No SKILL.md found at ${skillMdPath}`);
			process.exit(1);
		}

		const evalsDir = resolve(resolvedSkillPath, "evals");
		const evalsJsonPath = resolve(evalsDir, "evals.json");
		if (existsSync(evalsJsonPath) && !args.includes("--force")) {
			console.error(`  ${yellow("SKIP")} evals.json already exists at ${evalsJsonPath}`);
			console.error(`  ${dim("use --force to regenerate")}`);
			return;
		}

		const initModel = parseInitModel(args);
		console.log(`\n  ${bold("GENERATING")} evals for ${cyan(resolvedSkillPath)}`);
		console.log(`  ${dim(`model: ${initModel}`)}\n`);

		await generateEvalSuite(resolvedSkillPath, initModel);
		console.log(`  ${green("DONE")} Created ${evalsJsonPath}\n`);
		return;
	}

	const db = getDb();
	const model = parseModel(args);
	const timeout = parseTimeout(args);
	const jsonOutput = args.includes("--json");
	const baseline = args.includes("--baseline");

	const compareIdx = args.indexOf("--compare");
	const comparePath = compareIdx !== -1 ? args[compareIdx + 1] : undefined;

	const suitePath = parseSuite(args);
	const evalsPath = suitePath ? resolve(suitePath) : resolveEvalsPath(resolvedSkillPath);
	const suite = loadEvalSuite(evalsPath);

	console.log(`\n  ${bold("TESTING")} ${cyan(suite.skill_name)} ${dim(`(${suite.evals.length} evals)`)}`);
	console.log(`  ${dim(`evals: ${evalsPath}`)}`);
	console.log(`  ${dim(`model: ${model ?? "auto"}  timeout: ${timeout}s`)}`);
	if (baseline) console.log(`  ${dim("mode: baseline comparison (with skill vs without)")}`);
	console.log("");

	const grades = await runEvalSuite(suite.evals, model, timeout, db, false);

	if (!jsonOutput) {
		console.log(renderEvalResults(grades));
	}

	const stats = aggregateBenchmark(grades, "with_skill", suite.skill_name);
	saveBenchmark(db, stats);

	if (baseline) {
		console.log(`  ${bold("BASELINE")} ${dim("running without skills...")}\n`);

		const baselineGrades = await runEvalSuite(suite.evals, model, timeout, db, true);
		const baselineStats = aggregateBenchmark(baselineGrades, "baseline", suite.skill_name);
		saveBenchmark(db, baselineStats);

		const d = compareBenchmarks(stats, baselineStats);

		if (jsonOutput) {
			console.log(renderBenchmarkJson(stats));
			console.log(renderBenchmarkJson(baselineStats));
		} else {
			console.log(renderBenchmarkTable(stats));
			console.log(renderBenchmarkTable(baselineStats));
			console.log(renderComparisonTable(stats, baselineStats, d));

			const delta = stats.passRate.mean - baselineStats.passRate.mean;
			const sign = delta >= 0 ? "+" : "";
			const color = delta > 0 ? green : delta < 0 ? red : dim;
			console.log(`  ${bold("BASELINE IMPACT:")} ${color(`${sign}${(delta * 100).toFixed(0)}% pass rate`)} ${delta > 0 ? "(skill adds value)" : delta < 0 ? "(skill hurts)" : "(no difference)"}\n`);
		}
	} else if (comparePath) {
		const resolvedCompare = resolve(comparePath);
		const compareEvalsPath = suitePath ? resolve(suitePath) : resolveEvalsPath(resolvedCompare);
		const compareSuite = loadEvalSuite(compareEvalsPath);

		console.log(`  ${bold("COMPARING")} ${dim(`→ ${comparePath}`)}\n`);

		const compareGrades = await runEvalSuite(compareSuite.evals, model, timeout, db, false);
		const compareStats = aggregateBenchmark(compareGrades, "compare", compareSuite.skill_name);
		saveBenchmark(db, compareStats);

		const d = compareBenchmarks(stats, compareStats);

		if (jsonOutput) {
			console.log(renderBenchmarkJson(stats));
			console.log(renderBenchmarkJson(compareStats));
		} else {
			console.log(renderBenchmarkTable(stats));
			console.log(renderBenchmarkTable(compareStats));
			console.log(renderComparisonTable(stats, compareStats, d));
		}
	} else {
		if (jsonOutput) {
			console.log(renderBenchmarkJson(stats));
		} else {
			console.log(renderBenchmarkTable(stats));
		}
	}
}

async function runEvalSuite(
	evals: { id: number; prompt: string; expected_output: string; expectations: string[]; files: string[] }[],
	model: string | undefined,
	timeout: number,
	db: ReturnType<typeof getDb>,
	disableSkills = false,
): Promise<EvalGrade[]> {
	const grades: EvalGrade[] = [];

	for (const evalCase of evals) {
		const label = `  ${dim(`[${evalCase.id}/${evals.length}]`)} ${evalCase.prompt.slice(0, 50)}${evalCase.prompt.length > 50 ? "..." : ""}`;
		process.stdout.write(`${label} `);

		try {
			const trace = await runTrace({
				prompt: evalCase.prompt,
				model,
				timeout,
				disableSkills,
			});

			saveTrace(db, trace);

			const gradeResults = await gradeExpectations(
				evalCase.expectations,
				trace,
				evalCase.expected_output,
			);

			const passed = gradeResults.filter((g) => g.passed).length;
			const total = gradeResults.length;

			grades.push({
				evalId: evalCase.id,
				prompt: evalCase.prompt,
				grades: gradeResults,
				passed,
				failed: total - passed,
				total,
				passRate: total > 0 ? passed / total : 1,
				trace,
			});

			const icon = passed === total ? "✓" : passed > 0 ? "◐" : "✗";
			const color = passed === total ? "\x1b[32m" : passed > 0 ? "\x1b[33m" : "\x1b[31m";
			console.log(`${color}${icon}\x1b[0m ${dim(`${passed}/${total}`)}`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.log(`${red("✗")} ${dim(msg)}`);
		}
	}

	return grades;
}
