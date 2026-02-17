import { dim, green } from "./colors";

export function barChart(
	items: { name: string; value: number }[],
	width = 20,
): string {
	if (items.length === 0) return "";
	const max = Math.max(...items.map((i) => i.value));
	const maxNameLen = Math.max(...items.map((i) => i.name.length));

	return items
		.map((item) => {
			const filled = max === 0 ? 0 : Math.round((item.value / max) * width);
			const empty = width - filled;
			const bar = green("█".repeat(filled)) + dim("░".repeat(empty));
			const name = item.name.padStart(maxNameLen);
			return `  ${name}  ${bar}  ${item.value}`;
		})
		.join("\n");
}
