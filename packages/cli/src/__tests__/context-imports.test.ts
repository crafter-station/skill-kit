import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findContextFiles } from "../commands/context";

function project(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "skillkit-ctx-"));
	for (const [rel, content] of Object.entries(files)) {
		const full = join(dir, rel);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, content);
	}
	return dir;
}

/** Only sources produced from this temp dir; the walk also sees ~/.claude. */
function localSources(dir: string) {
	return findContextFiles(dir).filter((s) => s.path.startsWith(dir));
}

describe("findContextFiles", () => {
	it("resolves a direct @import", () => {
		const dir = project({
			"CLAUDE.md": "@docs/a.md\n",
			"docs/a.md": "alpha",
		});
		const names = localSources(dir).map((s) => s.name);

		expect(names).toEqual(["a.md"]);
	});

	// An imported file may import more; the model pays for the whole closure.
	it("follows imports transitively", () => {
		const dir = project({
			"CLAUDE.md": "@a.md\n",
			"a.md": "@b.md\n",
			"b.md": "@c.md\n",
			"c.md": "leaf",
		});
		const names = localSources(dir)
			.map((s) => s.name)
			.sort();

		expect(names).toEqual(["a.md", "b.md", "c.md"]);
	});

	// Counting a shared file once per referrer inflated the reported tax.
	it("counts a file referenced twice only once", () => {
		const dir = project({
			"CLAUDE.md": "@a.md\n@b.md\n",
			"a.md": "@shared.md\n",
			"b.md": "@shared.md\n",
			"shared.md": "x".repeat(500),
		});
		const shared = localSources(dir).filter((s) => s.name === "shared.md");

		expect(shared).toHaveLength(1);
	});

	it("terminates on an import cycle", () => {
		const dir = project({
			"CLAUDE.md": "@a.md\n",
			"a.md": "@b.md\n",
			"b.md": "@a.md\n",
		});

		const names = localSources(dir)
			.map((s) => s.name)
			.sort();
		expect(names).toEqual(["a.md", "b.md"]);
	});

	it("ignores an import whose target does not exist", () => {
		const dir = project({ "CLAUDE.md": "@missing.md\n" });

		expect(localSources(dir)).toHaveLength(0);
	});

	it("records the byte length of each imported file", () => {
		const dir = project({
			"CLAUDE.md": "@a.md\n",
			"a.md": "y".repeat(370),
		});
		const source = localSources(dir).find((s) => s.name === "a.md");

		expect(source?.chars).toBe(370);
		expect(source?.tokens).toBe(100);
	});
});
