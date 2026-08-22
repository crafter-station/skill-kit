import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	chmodSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	isRegistrySkill,
	removeFromLockFile,
	removeSymlinks,
} from "../commands/prune";

describe("prune helpers", () => {
	let tmpHome: string;
	let originalHome: string | undefined;
	let errorSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		originalHome = process.env.HOME;
		tmpHome = mkdtempSync(join(tmpdir(), "skillkit-prune-"));
		process.env.HOME = tmpHome;
		errorSpy = spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		errorSpy.mockRestore();
		process.env.HOME = originalHome;
		rmSync(tmpHome, { recursive: true, force: true });
	});

	function lockPath(): string {
		return join(tmpHome, ".agents", ".skill-lock.json");
	}

	function writeMalformedLock(contents = "not-json{"): string {
		mkdirSync(join(tmpHome, ".agents"), { recursive: true });
		writeFileSync(lockPath(), contents, "utf-8");
		return contents;
	}

	it("warns on malformed lock and isRegistrySkill returns false without mutating", () => {
		const original = writeMalformedLock("not-json{");

		expect(isRegistrySkill("skill-a")).toBe(false);
		expect(errorSpy).toHaveBeenCalled();
		const message = String(errorSpy.mock.calls[0]?.[0] ?? "");
		expect(message).toContain("skill-lock");
		expect(readFileSync(lockPath(), "utf-8")).toBe(original);
	});

	it("warns on malformed lock and removeFromLockFile preserves corrupt bytes", () => {
		const original = writeMalformedLock("not-json{");

		removeFromLockFile("skill-a");

		expect(errorSpy).toHaveBeenCalled();
		const message = String(errorSpy.mock.calls[0]?.[0] ?? "");
		expect(message).toContain("skill-lock");
		expect(readFileSync(lockPath(), "utf-8")).toBe(original);
	});

	it("isRegistrySkill returns correctly for a valid lock without warnings", () => {
		mkdirSync(join(tmpHome, ".agents"), { recursive: true });
		writeFileSync(
			lockPath(),
			`${JSON.stringify({ skills: { "skill-a": true } }, null, 2)}\n`,
			"utf-8",
		);

		expect(isRegistrySkill("skill-a")).toBe(true);
		expect(isRegistrySkill("skill-b")).toBe(false);
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("removeFromLockFile deletes an entry from a valid lock without warnings", () => {
		mkdirSync(join(tmpHome, ".agents"), { recursive: true });
		writeFileSync(
			lockPath(),
			`${JSON.stringify(
				{ skills: { "skill-a": true, "skill-b": true } },
				null,
				2,
			)}\n`,
			"utf-8",
		);

		removeFromLockFile("skill-a");

		expect(errorSpy).not.toHaveBeenCalled();
		const data = JSON.parse(readFileSync(lockPath(), "utf-8")) as {
			skills: Record<string, unknown>;
		};
		expect(data.skills["skill-a"]).toBeUndefined();
		expect(data.skills["skill-b"]).toBe(true);
	});

	it("removeSymlinks skips regular files, removes dangling links, warns on failure", () => {
		const skillsDir = join(tmpHome, ".cursor", "skills");
		mkdirSync(skillsDir, { recursive: true });

		const regularPath = join(skillsDir, "skill-regular");
		writeFileSync(regularPath, "not a symlink", "utf-8");

		const danglingPath = join(skillsDir, "skill-dangling");
		symlinkSync("/nonexistent/skill-dangling-target", danglingPath);

		const blockedDir = join(tmpHome, ".claude", "skills");
		mkdirSync(blockedDir, { recursive: true });
		const blockedPath = join(blockedDir, "skill-blocked");
		symlinkSync("/nonexistent/skill-blocked-target", blockedPath);
		chmodSync(blockedDir, 0o555);

		try {
			const cleaned = removeSymlinks("skill-regular");
			expect(cleaned).toBe(0);
			expect(existsSync(regularPath)).toBe(true);
			expect(lstatSync(regularPath).isSymbolicLink()).toBe(false);
			expect(errorSpy).not.toHaveBeenCalled();

			errorSpy.mockClear();
			const danglingCleaned = removeSymlinks("skill-dangling");
			expect(danglingCleaned).toBe(1);
			expect(existsSync(danglingPath)).toBe(false);
			try {
				lstatSync(danglingPath);
				expect.unreachable("dangling symlink should have been removed");
			} catch {
				/* expected ENOENT */
			}
			expect(errorSpy).not.toHaveBeenCalled();

			errorSpy.mockClear();
			const blockedCleaned = removeSymlinks("skill-blocked");
			expect(blockedCleaned).toBe(0);
			expect(errorSpy).toHaveBeenCalled();
			const message = String(errorSpy.mock.calls[0]?.[0] ?? "");
			expect(message).toContain("symlink");
			expect(lstatSync(blockedPath).isSymbolicLink()).toBe(true);
		} finally {
			chmodSync(blockedDir, 0o755);
		}
	});

	it("treats a missing lock file as non-error silence", () => {
		expect(isRegistrySkill("skill-a")).toBe(false);
		removeFromLockFile("skill-a");
		expect(errorSpy).not.toHaveBeenCalled();
		expect(existsSync(lockPath())).toBe(false);
	});

	it("rejects traversal names without touching outside symlinks", () => {
		const cursorDir = join(tmpHome, ".cursor");
		const outsideTarget = join(tmpHome, "outside-target");
		const outsideLink = join(cursorDir, "outside-link");
		mkdirSync(cursorDir, { recursive: true });
		mkdirSync(outsideTarget);
		symlinkSync(outsideTarget, outsideLink);

		expect(removeSymlinks("../outside-link")).toBe(0);
		expect(lstatSync(outsideLink).isSymbolicLink()).toBe(true);
		expect(removeSymlinks("..\\outside-link")).toBe(0);
		expect(lstatSync(outsideLink).isSymbolicLink()).toBe(true);
		expect(errorSpy).toHaveBeenCalledTimes(2);
		expect(String(errorSpy.mock.calls[0]?.[0] ?? "")).toContain(
			"unsafe skill name",
		);
	});
});
