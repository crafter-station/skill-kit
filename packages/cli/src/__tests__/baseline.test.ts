import { describe, expect, it } from "bun:test";
import {
	type BaselineSnapshot,
	type BaselineSource,
	diffBaseline,
	formatRelativeAge,
} from "../context/baseline";

function snapshot(
	sources: BaselineSource[],
	createdAt = "2026-07-01T00:00:00.000Z",
): BaselineSnapshot {
	return {
		name: "test",
		createdAt,
		cwd: "/tmp/project",
		totalTokens: sources.reduce((s, x) => s + x.tokens, 0),
		sources,
	};
}

describe("diffBaseline", () => {
	it("reports no changes when nothing moved", () => {
		const sources: BaselineSource[] = [
			{ name: "./CLAUDE.md", type: "claude-md", tokens: 6500 },
			{ name: "skill-a", type: "skill-metadata", tokens: 200 },
		];
		const diff = diffBaseline(snapshot(sources), sources);

		expect(diff.changes).toHaveLength(0);
		expect(diff.totalDelta).toBe(0);
		expect(diff.pctDelta).toBe(0);
	});

	it("detects an added source", () => {
		const before: BaselineSource[] = [
			{ name: "./CLAUDE.md", type: "claude-md", tokens: 6500 },
		];
		const after: BaselineSource[] = [
			...before,
			{ name: "firecrawl", type: "mcp", tokens: 3200 },
		];
		const diff = diffBaseline(snapshot(before), after);

		expect(diff.changes).toHaveLength(1);
		expect(diff.changes[0]).toMatchObject({
			name: "firecrawl",
			kind: "added",
			before: 0,
			after: 3200,
			delta: 3200,
		});
		expect(diff.totalDelta).toBe(3200);
	});

	it("detects a removed source", () => {
		const before: BaselineSource[] = [
			{ name: "./CLAUDE.md", type: "claude-md", tokens: 6500 },
			{ name: "dead-skill", type: "skill-metadata", tokens: 412 },
		];
		const after: BaselineSource[] = [
			{ name: "./CLAUDE.md", type: "claude-md", tokens: 6500 },
		];
		const diff = diffBaseline(snapshot(before), after);

		expect(diff.changes).toHaveLength(1);
		expect(diff.changes[0]).toMatchObject({
			name: "dead-skill",
			kind: "removed",
			after: 0,
			delta: -412,
		});
		expect(diff.totalDelta).toBe(-412);
	});

	it("detects a changed source", () => {
		const before: BaselineSource[] = [
			{ name: "./CLAUDE.md", type: "claude-md", tokens: 6500 },
		];
		const after: BaselineSource[] = [
			{ name: "./CLAUDE.md", type: "claude-md", tokens: 6691 },
		];
		const diff = diffBaseline(snapshot(before), after);

		expect(diff.changes[0]).toMatchObject({
			kind: "changed",
			before: 6500,
			after: 6691,
			delta: 191,
		});
	});

	it("keys by type so a file and a skill sharing a name never collide", () => {
		const before: BaselineSource[] = [
			{ name: "research", type: "claude-md", tokens: 100 },
		];
		const after: BaselineSource[] = [
			{ name: "research", type: "claude-md", tokens: 100 },
			{ name: "research", type: "skill-metadata", tokens: 250 },
		];
		const diff = diffBaseline(snapshot(before), after);

		expect(diff.changes).toHaveLength(1);
		expect(diff.changes[0]).toMatchObject({
			kind: "added",
			type: "skill-metadata",
			delta: 250,
		});
	});

	it("sorts changes by magnitude, largest first", () => {
		const before: BaselineSource[] = [
			{ name: "small", type: "skill-metadata", tokens: 100 },
			{ name: "big", type: "skill-metadata", tokens: 100 },
		];
		const after: BaselineSource[] = [
			{ name: "small", type: "skill-metadata", tokens: 150 },
			{ name: "big", type: "skill-metadata", tokens: 5000 },
		];
		const diff = diffBaseline(snapshot(before), after);

		expect(diff.changes.map((c) => c.name)).toEqual(["big", "small"]);
	});

	it("computes percent delta against the baseline total", () => {
		const before: BaselineSource[] = [
			{ name: "a", type: "claude-md", tokens: 1000 },
		];
		const after: BaselineSource[] = [
			{ name: "a", type: "claude-md", tokens: 1290 },
		];
		const diff = diffBaseline(snapshot(before), after);

		expect(diff.pctDelta).toBeCloseTo(29, 5);
	});

	it("does not divide by zero on an empty baseline", () => {
		const diff = diffBaseline(snapshot([]), [
			{ name: "a", type: "claude-md", tokens: 500 },
		]);

		expect(diff.pctDelta).toBe(0);
		expect(diff.totalDelta).toBe(500);
	});
});

describe("formatRelativeAge", () => {
	const now = new Date("2026-07-25T12:00:00.000Z");

	it("formats minutes, hours and days", () => {
		expect(formatRelativeAge("2026-07-25T11:59:40.000Z", now)).toBe("just now");
		expect(formatRelativeAge("2026-07-25T11:30:00.000Z", now)).toBe("30m ago");
		expect(formatRelativeAge("2026-07-25T09:00:00.000Z", now)).toBe("3h ago");
		expect(formatRelativeAge("2026-07-19T12:00:00.000Z", now)).toBe("6d ago");
	});

	it("handles an unparseable timestamp", () => {
		expect(formatRelativeAge("not-a-date", now)).toBe("unknown");
	});
});
