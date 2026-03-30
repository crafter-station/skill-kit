import { describe, expect, it } from "bun:test";
import { sparkline } from "../tui/sparkline";

describe("sparkline", () => {
	it("returns empty string for empty array", () => {
		expect(sparkline([])).toBe("");
	});

	it("handles all zeros", () => {
		const result = sparkline([0, 0, 0]);
		expect(result).toContain("▁▁▁");
	});

	it("scales to max value", () => {
		const result = sparkline([0, 5, 10]);
		expect(result.length).toBeGreaterThan(0);
	});

	it("handles single value", () => {
		const result = sparkline([42]);
		expect(result.length).toBeGreaterThan(0);
	});
});
