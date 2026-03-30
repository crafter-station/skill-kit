import { bold, dim, green } from "./colors";

const BLOCKS = [" ", "░", "▒", "▓", "█"];

export function renderHeatmap(
	data: Map<string, number>,
	weeks = 52,
): string {
	const today = new Date();
	const lines: string[] = [];

	const startDate = new Date(today);
	startDate.setDate(today.getDate() - weeks * 7 + 1);
	while (startDate.getDay() !== 0) {
		startDate.setDate(startDate.getDate() - 1);
	}

	const values: number[] = [];
	const dateStr = (d: Date) => d.toISOString().slice(0, 10);

	const current = new Date(startDate);
	while (current <= today) {
		const v = data.get(dateStr(current)) ?? 0;
		if (v > 0) values.push(v);
		current.setDate(current.getDate() + 1);
	}

	if (values.length === 0) return `  ${dim("No activity data")}\n`;

	values.sort((a, b) => a - b);
	const p25 = values[Math.floor(values.length * 0.25)] ?? 0;
	const p50 = values[Math.floor(values.length * 0.5)] ?? 0;
	const p75 = values[Math.floor(values.length * 0.75)] ?? 0;

	function level(v: number): number {
		if (v <= 0) return 0;
		if (v <= p25) return 1;
		if (v <= p50) return 2;
		if (v <= p75) return 3;
		return 4;
	}

	const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
	const grid: number[][] = Array.from({ length: 7 }, () => []);

	current.setTime(startDate.getTime());
	let col = 0;
	while (current <= today) {
		const dow = current.getDay();
		const v = data.get(dateStr(current)) ?? 0;
		grid[dow]!.push(level(v));
		if (dow === 6) col++;
		current.setDate(current.getDate() + 1);
	}

	const totalWeeks = grid[0]!.length;

	const months: string[] = [];
	let lastMonth = -1;
	current.setTime(startDate.getTime());
	for (let w = 0; w < totalWeeks; w++) {
		const weekStart = new Date(startDate);
		weekStart.setDate(startDate.getDate() + w * 7);
		const m = weekStart.getMonth();
		if (m !== lastMonth) {
			const name = weekStart.toLocaleDateString("en", { month: "short" });
			months.push(name.padEnd(Math.max(1, 1)));
			lastMonth = m;
		} else {
			months.push(" ");
		}
	}

	lines.push(`  ${dim("    ")}${months.map((m) => (m.trim() ? dim(m) : " ")).join("")}`);

	for (let dow = 0; dow < 7; dow++) {
		const label = (dayLabels[dow] ?? "").padStart(3);
		const cells = grid[dow]!.map((lvl) => {
			const block = BLOCKS[lvl] ?? " ";
			return lvl === 0 ? dim(block) : green(block);
		});
		lines.push(`  ${dim(label)} ${cells.join("")}`);
	}

	const activeDays = [...data.values()].filter((v) => v > 0).length;
	const totalCost = [...data.values()].reduce((s, v) => s + v, 0);
	lines.push(`\n  ${dim("Active days:")} ${bold(String(activeDays))}  ${dim("Total:")} ${bold(`$${totalCost.toFixed(2)}`)}`);
	lines.push(`  ${dim(BLOCKS[1]!)} ${dim("<")}$${p25.toFixed(2)}  ${green(BLOCKS[2]!)} $${p50.toFixed(2)}  ${green(BLOCKS[3]!)} $${p75.toFixed(2)}  ${green(BLOCKS[4]!)} ${dim(">")}$${p75.toFixed(2)}`);

	return lines.join("\n") + "\n";
}
