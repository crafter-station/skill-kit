import { green, red, yellow } from "./colors";

export function healthGauge(score: number): string {
	const clamped = Math.max(0, Math.min(100, Math.round(score)));
	const filled = Math.round(clamped / 10);
	const empty = 10 - filled;
	const bar = "█".repeat(filled) + "░".repeat(empty);
	const pct = `${clamped}%`;
	const colored =
		clamped >= 80 ? green(bar) : clamped >= 60 ? yellow(bar) : red(bar);
	return `[${colored}] ${pct}`;
}
