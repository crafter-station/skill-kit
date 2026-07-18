import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScanCache } from "../scanner/scan-cache";

function tempFile(content = "x"): string {
	const dir = mkdtempSync(join(tmpdir(), "skillkit-cache-"));
	const file = join(dir, "session.jsonl");
	writeFileSync(file, content);
	return file;
}

describe("ScanCache", () => {
	it("skips unchanged files on the second scan", () => {
		const db = new Database(":memory:");
		const file = tempFile();

		const first = new ScanCache(db, { salt: "s1" });
		expect(first.shouldSkip(file)).toBe(false);
		first.flush();

		const second = new ScanCache(db, { salt: "s1" });
		expect(second.shouldSkip(file)).toBe(true);
	});

	it("rescans when the file changes", () => {
		const db = new Database(":memory:");
		const file = tempFile();

		const first = new ScanCache(db, { salt: "s1" });
		first.shouldSkip(file);
		first.flush();

		writeFileSync(file, "modified content");
		const second = new ScanCache(db, { salt: "s1" });
		expect(second.shouldSkip(file)).toBe(false);
	});

	it("rescans when only mtime changes", () => {
		const db = new Database(":memory:");
		const file = tempFile();

		const first = new ScanCache(db, { salt: "s1" });
		first.shouldSkip(file);
		first.flush();

		const future = new Date(Date.now() + 5000);
		utimesSync(file, future, future);
		const second = new ScanCache(db, { salt: "s1" });
		expect(second.shouldSkip(file)).toBe(false);
	});

	it("invalidates everything when the skills salt changes", () => {
		const db = new Database(":memory:");
		const file = tempFile();

		const first = new ScanCache(db, { salt: "s1" });
		first.shouldSkip(file);
		first.flush();

		const second = new ScanCache(db, { salt: "s2" });
		expect(second.shouldSkip(file)).toBe(false);
	});

	it("force mode rescans but rebuilds the cache", () => {
		const db = new Database(":memory:");
		const file = tempFile();

		const first = new ScanCache(db, { salt: "s1" });
		first.shouldSkip(file);
		first.flush();

		const forced = new ScanCache(db, { salt: "s1", force: true });
		expect(forced.shouldSkip(file)).toBe(false);
		forced.flush();

		const after = new ScanCache(db, { salt: "s1" });
		expect(after.shouldSkip(file)).toBe(true);
	});
});
