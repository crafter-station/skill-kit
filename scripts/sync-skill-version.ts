import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliPackageJson = join(root, "packages", "cli", "package.json");
const skillFiles = [
	join(root, "skills", "skillkit", "SKILL.md"),
	join(root, "packages", "cli", "src", "skill-data", "core", "SKILL.md"),
];

const cliVersion = (
	JSON.parse(readFileSync(cliPackageJson, "utf-8")) as { version: string }
).version;
const write = process.argv.includes("--write");
let failed = false;

for (const skillFile of skillFiles) {
	const label = relative(root, skillFile);
	const contents = readFileSync(skillFile, "utf-8");
	const match = contents.match(/^version:\s*(.+)$/m);
	const skillVersion = match?.[1]?.trim();

	if (write) {
		const next = match
			? contents.replace(/^version:\s*.+$/m, `version: ${cliVersion}`)
			: contents.replace(/^(name:\s*.+)$/m, `$1\nversion: ${cliVersion}`);
		if (next === contents) {
			console.log(`${label} already ${cliVersion}`);
		} else {
			writeFileSync(skillFile, next);
			console.log(`${label} set to ${cliVersion}`);
		}
		continue;
	}

	if (!skillVersion) {
		console.error(`${label} has no version field in frontmatter`);
		failed = true;
	} else if (skillVersion !== cliVersion) {
		console.error(`${label} is ${skillVersion}, CLI is ${cliVersion}`);
		failed = true;
	} else {
		console.log(`${label} matches CLI (${cliVersion})`);
	}
}

if (failed) {
	console.error("run: bun run skill:version --write");
	process.exit(1);
}
