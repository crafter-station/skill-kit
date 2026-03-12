import type { BenchmarkDelta, BenchmarkStats } from "./benchmark";
import type { EvalGrade } from "./grader";
import { bold, cyan, dim, green, red, yellow } from "../tui/colors";

function pct(n: number): string {
	return `${(n * 100).toFixed(0)}%`;
}

function deltaHigherBetter(n: number, suffix = ""): string {
	if (n > 0) return green(`+${n.toFixed(1)}${suffix}`);
	if (n < 0) return red(`${n.toFixed(1)}${suffix}`);
	return dim(`0${suffix}`);
}

function deltaLowerBetter(n: number, suffix = ""): string {
	if (n < 0) return green(`${n.toFixed(1)}${suffix}`);
	if (n > 0) return red(`+${n.toFixed(1)}${suffix}`);
	return dim(`0${suffix}`);
}

export function renderEvalResults(grades: EvalGrade[]): string {
	const lines: string[] = [];
	lines.push("");

	for (const g of grades) {
		const status = g.passRate === 1 ? green("PASS") : g.passRate > 0 ? yellow("PARTIAL") : red("FAIL");
		lines.push(`  ${bold(`Eval #${g.evalId}`)} ${status} ${dim(`(${g.passed}/${g.total})`)}`);
		lines.push(`  ${dim(g.prompt.length > 70 ? `${g.prompt.slice(0, 70)}...` : g.prompt)}`);
		lines.push("");

		for (const gr of g.grades) {
			const icon = gr.passed ? green("  ✓") : red("  ✗");
			lines.push(`${icon} ${gr.expectation}`);
			if (!gr.passed) {
				lines.push(`    ${dim(gr.evidence)}`);
			}
		}
		lines.push("");
	}

	return lines.join("\n");
}

export function renderBenchmarkTable(stats: BenchmarkStats): string {
	const lines: string[] = [];
	lines.push("");
	lines.push(`  ${bold("BENCHMARK")} ${dim(stats.benchmarkId)}`);
	lines.push(`  ${dim(`Skill: ${stats.skillName}  Config: ${stats.config}  Runs: ${stats.runs}`)}`);
	lines.push("");

	lines.push(`  Pass rate:  ${bold(pct(stats.passRate.mean))} ${dim(`± ${pct(stats.passRate.stddev)}`)}`);
	lines.push(`  Tokens:     ${bold(String(Math.round(stats.tokens.mean)))} ${dim(`± ${Math.round(stats.tokens.stddev)}`)}`);
	lines.push(`  Time:       ${bold(`${stats.timeSeconds.mean.toFixed(1)}s`)} ${dim(`± ${stats.timeSeconds.stddev.toFixed(1)}s`)}`);
	lines.push("");

	const idW = 6;
	const passW = 8;
	const tokW = 8;
	const timeW = 8;

	lines.push(
		`  ${dim("EVAL".padEnd(idW))}  ${dim("PASS".padStart(passW))}  ${dim("TOKENS".padStart(tokW))}  ${dim("TIME".padStart(timeW))}  ${dim("PROMPT")}`,
	);
	lines.push(`  ${"─".repeat(idW + passW + tokW + timeW + 50)}`);

	for (const e of stats.perEval) {
		const id = `#${e.evalId}`.padEnd(idW);
		const pass = pct(e.passRate).padStart(passW);
		const tok = String(e.tokens).padStart(tokW);
		const time = `${e.timeSeconds.toFixed(1)}s`.padStart(timeW);
		const prompt = e.prompt.length > 40 ? `${e.prompt.slice(0, 40)}...` : e.prompt;
		lines.push(`  ${id}  ${pass}  ${tok}  ${time}  ${dim(prompt)}`);
	}

	lines.push("");
	return lines.join("\n");
}

export function renderComparisonTable(
	a: BenchmarkStats,
	b: BenchmarkStats,
	d: BenchmarkDelta,
): string {
	const lines: string[] = [];
	lines.push("");
	lines.push(`  ${bold("COMPARISON")} ${cyan(b.config)} ${dim("→")} ${cyan(a.config)}`);
	lines.push(`  ${dim(`Skill: ${a.skillName}`)}`);
	lines.push("");

	const w = 14;
	lines.push(`  ${dim("METRIC".padEnd(w))}  ${dim(b.config.padStart(10))}  ${dim(a.config.padStart(10))}  ${dim("DELTA")}`);
	lines.push(`  ${"─".repeat(w + 36)}`);

	lines.push(
		`  ${"Pass rate".padEnd(w)}  ${pct(b.passRate.mean).padStart(10)}  ${pct(a.passRate.mean).padStart(10)}  ${deltaHigherBetter(-d.passRateDelta * 100, "%")}`,
	);
	lines.push(
		`  ${"Tokens".padEnd(w)}  ${String(Math.round(b.tokens.mean)).padStart(10)}  ${String(Math.round(a.tokens.mean)).padStart(10)}  ${deltaLowerBetter(-d.tokensDelta)}`,
	);
	lines.push(
		`  ${"Time (s)".padEnd(w)}  ${b.timeSeconds.mean.toFixed(1).padStart(10)}  ${a.timeSeconds.mean.toFixed(1).padStart(10)}  ${deltaLowerBetter(-d.timeDelta, "s")}`,
	);

	lines.push("");
	return lines.join("\n");
}

export function renderBenchmarkJson(stats: BenchmarkStats): string {
	return JSON.stringify(
		{
			benchmark_id: stats.benchmarkId,
			skill_name: stats.skillName,
			config: stats.config,
			runs: stats.runs,
			pass_rate: stats.passRate,
			tokens: stats.tokens,
			time_seconds: stats.timeSeconds,
			per_eval: stats.perEval.map((e) => ({
				eval_id: e.evalId,
				prompt: e.prompt,
				pass_rate: e.passRate,
				tokens: e.tokens,
				time_seconds: e.timeSeconds,
			})),
		},
		null,
		2,
	);
}
