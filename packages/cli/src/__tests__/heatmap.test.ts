import { describe, expect, it } from "bun:test";
import { renderHeatmap } from "../tui/heatmap";

function daysAgo(n: number): string {
	return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

describe("heatmap", () => {
	it("renders empty state", () => {
		const result = renderHeatmap(new Map());
		expect(result).toContain("No activity");
	});

	it("renders with data", () => {
		const data = new Map<string, number>();
		for (let i = 0; i < 14; i++) {
			data.set(daysAgo(i), Math.random() * 100);
		}
		const result = renderHeatmap(data);
		expect(result).toContain("Active days:");
		expect(result).toContain("Total:");
		expect(result).toContain("Mon");
	});

	it("handles single day", () => {
		const data = new Map<string, number>([[daysAgo(0), 5.0]]);
		const result = renderHeatmap(data);
		expect(result).toContain("Active days:");
		expect(result).toContain("1");
	});

	it("respects weeks parameter", () => {
		const data = new Map<string, number>();
		for (let i = 0; i < 400; i++) {
			data.set(daysAgo(i), 1.0);
		}
		const full = renderHeatmap(data, 52);
		const short = renderHeatmap(data, 12);
		expect(full.length).toBeGreaterThan(short.length);
	});
});
