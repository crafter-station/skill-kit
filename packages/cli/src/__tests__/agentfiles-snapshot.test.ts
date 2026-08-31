import { describe, expect, test } from "bun:test";
import { parseCapturedJson } from "../agentfiles/snapshot";

describe("Agentfiles snapshot", () => {
	test("extracts object and array JSON after command output", () => {
		expect(parseCapturedJson('status\n{"ok":true}')).toEqual({ ok: true });
		expect(parseCapturedJson("status\n[1,2]")).toEqual([1, 2]);
	});

	test("returns null when output has no valid JSON", () => {
		expect(parseCapturedJson("No data found")).toBeNull();
	});
});
