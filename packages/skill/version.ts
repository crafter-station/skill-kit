/**
 * Keeps packages/skill/SKILL.md's version in step with the CLI it documents.
 *
 *   bun run skill:version         check, non-zero exit on mismatch (CI)
 *   bun run skill:version --write update SKILL.md to the CLI's version
 *
 * A skill that advertises a version it does not actually describe is worse
 * than one carrying no version at all, so the check is a hard failure rather
 * than a warning.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const here = dirname(new URL(import.meta.url).pathname);
const cliPackageJson = join(here, "..", "cli", "package.json");
const skillMd = join(here, "SKILL.md");

const cliVersion = (
	JSON.parse(readFileSync(cliPackageJson, "utf-8")) as { version: string }
).version;

const contents = readFileSync(skillMd, "utf-8");
const match = contents.match(/^version:\s*(.+)$/m);
const skillVersion = match?.[1]?.trim();

const write = process.argv.includes("--write");

if (write) {
	const next = match
		? contents.replace(/^version:\s*.+$/m, `version: ${cliVersion}`)
		: contents.replace(/^(name:\s*.+)$/m, `$1\nversion: ${cliVersion}`);

	if (next === contents) {
		console.log(`skill version already ${cliVersion}`);
	} else {
		writeFileSync(skillMd, next);
		console.log(`skill version set to ${cliVersion}`);
	}
	process.exit(0);
}

if (!skillVersion) {
	console.error("packages/skill/SKILL.md has no version field in frontmatter");
	console.error("run: bun run skill:version --write");
	process.exit(1);
}

if (skillVersion !== cliVersion) {
	console.error("skill version does not match the CLI");
	console.error(`  packages/cli/package.json : ${cliVersion}`);
	console.error(`  packages/skill/SKILL.md   : ${skillVersion}`);
	console.error("run: bun run skill:version --write");
	process.exit(1);
}

console.log(`skill version matches CLI (${cliVersion})`);
