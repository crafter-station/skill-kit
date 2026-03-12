import type { EvalGrade } from "./grader";

export interface BenchmarkStats {
	benchmarkId: string;
	skillName: string;
	config: string;
	runs: number;
	passRate: { mean: number; stddev: number };
	tokens: { mean: number; stddev: number };
	timeSeconds: { mean: number; stddev: number };
	perEval: EvalBenchmark[];
}

export interface EvalBenchmark {
	evalId: number;
	prompt: string;
	passRate: number;
	tokens: number;
	timeSeconds: number;
}

export interface BenchmarkDelta {
	configA: string;
	configB: string;
	passRateDelta: number;
	tokensDelta: number;
	timeDelta: number;
}

function mean(values: number[]): number {
	if (values.length === 0) return 0;
	return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
	if (values.length < 2) return 0;
	const m = mean(values);
	const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
	return Math.sqrt(variance);
}

export function aggregateBenchmark(
	grades: EvalGrade[],
	config: string,
	skillName: string,
): BenchmarkStats {
	const benchmarkId = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

	const passRates = grades.map((g) => g.passRate);
	const tokenCounts = grades.map((g) => g.trace.tokensTotal);
	const timings = grades.map((g) => g.trace.durationMs / 1000);

	const perEval: EvalBenchmark[] = grades.map((g) => ({
		evalId: g.evalId,
		prompt: g.prompt,
		passRate: g.passRate,
		tokens: g.trace.tokensTotal,
		timeSeconds: g.trace.durationMs / 1000,
	}));

	return {
		benchmarkId,
		skillName,
		config,
		runs: grades.length,
		passRate: { mean: mean(passRates), stddev: stddev(passRates) },
		tokens: { mean: mean(tokenCounts), stddev: stddev(tokenCounts) },
		timeSeconds: { mean: mean(timings), stddev: stddev(timings) },
		perEval,
	};
}

export function compareBenchmarks(
	a: BenchmarkStats,
	b: BenchmarkStats,
): BenchmarkDelta {
	return {
		configA: a.config,
		configB: b.config,
		passRateDelta: b.passRate.mean - a.passRate.mean,
		tokensDelta: b.tokens.mean - a.tokens.mean,
		timeDelta: b.timeSeconds.mean - a.timeSeconds.mean,
	};
}
