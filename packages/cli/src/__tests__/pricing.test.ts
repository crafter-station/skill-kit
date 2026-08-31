import { describe, expect, it } from "bun:test";
import { getPricing, shouldPromptForPlan } from "../commands/burn";

describe("getPricing", () => {
	it("keeps published cache pricing for Anthropic models", () => {
		const pricing = getPricing("claude-opus-4");

		expect(pricing.input).toBe(15);
		expect(pricing.cacheCreate).toBe(18.75);
		expect(pricing.cacheRead).toBe(1.5);
	});

	// Most entries in MODEL_PRICING declare no cache pricing. Reading those
	// fields raw gave undefined, and tokens * undefined is NaN, which then
	// spread through every total it was added to and voided the cost report.
	it("derives cache pricing for models that declare none", () => {
		const pricing = getPricing("gpt-5.4");

		expect(pricing.cacheCreate).toBeDefined();
		expect(pricing.cacheRead).toBeDefined();
		expect(Number.isFinite(pricing.cacheCreate)).toBe(true);
		expect(Number.isFinite(pricing.cacheRead)).toBe(true);
	});

	it("never yields NaN when costing a session with cache tokens", () => {
		for (const model of [
			"gpt-5.4",
			"gpt-5",
			"claude-opus-4",
			"totally-unknown-model",
		]) {
			const p = getPricing(model);
			const cost =
				(100 * p.input +
					50 * p.output +
					1000 * p.cacheCreate +
					5000 * p.cacheRead) /
				1_000_000;

			expect(Number.isNaN(cost)).toBe(false);
			expect(cost).toBeGreaterThan(0);
		}
	});

	it("prices a cache read below a cache write", () => {
		const pricing = getPricing("gpt-5.4");

		expect(pricing.cacheRead).toBeLessThan(pricing.cacheCreate);
	});

	it("falls back to mid-tier pricing for an unknown model", () => {
		const pricing = getPricing("some-model-that-does-not-exist");

		expect(pricing.input).toBe(2);
		expect(pricing.output).toBe(10);
		expect(Number.isFinite(pricing.cacheRead)).toBe(true);
	});
});

describe("plan prompt", () => {
	it("never prompts for JSON output", () => {
		expect(shouldPromptForPlan(true, false, true)).toBe(false);
		expect(shouldPromptForPlan(true, false, false)).toBe(true);
	});
});
