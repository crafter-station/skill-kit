import { green } from "./colors";

const SPARKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export function sparkline(values: number[]): string {
	if (values.length === 0) return "";
	const max = Math.max(...values);
	if (max === 0) {
		const line = (SPARKS[0] ?? "▁").repeat(values.length);
		return green(line);
	}
	const chars = values.map((v) => {
		const idx = Math.min(Math.floor((v / max) * 7), 7);
		return SPARKS[idx] ?? "█";
	});
	return green(chars.join(""));
}
