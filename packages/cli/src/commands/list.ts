import { detectSkillSource, scanInstalledSkills } from "../scanner/skills";
import { bold, cyan, dim } from "../tui/colors";

function formatSize(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${bytes} B`;
}

function truncate(s: string, max: number): string {
	if (s.length <= max) return s;
	return `${s.slice(0, max - 3)}...`;
}

export function runList(): void {
	const skills = scanInstalledSkills();

	if (skills.length === 0) {
		console.log("\n  No skills found.\n");
		return;
	}

	const totalSize = skills.reduce((acc, s) => acc + s.size, 0);

	console.log(`\n  ${bold(`INSTALLED SKILLS (${skills.length})`)}\n`);

	const nameWidth = 24;
	const descWidth = 34;
	const sourceWidth = 14;
	const sizeWidth = 10;

	const header = `  ${"NAME".padEnd(nameWidth)}${"DESCRIPTION".padEnd(descWidth)}${"SOURCE".padEnd(sourceWidth)}${"SIZE".padStart(sizeWidth)}`;
	console.log(dim(header));

	for (const skill of skills) {
		const name = cyan(skill.name.padEnd(nameWidth));
		const desc = dim(
			truncate(skill.description || "", descWidth).padEnd(descWidth),
		);
		const rawSource = detectSkillSource(skill);
		const sourceLabel =
			rawSource === "manual" || rawSource === "skills.sh"
				? rawSource
				: (rawSource.split("@")[0] ?? rawSource);
		const source = dim(
			truncate(sourceLabel, sourceWidth - 1).padEnd(sourceWidth),
		);
		const size = formatSize(skill.size).padStart(sizeWidth);
		console.log(`  ${name}${desc}${source}${size}`);
	}

	console.log(
		`\n  ${dim(`Total: ${skills.length} skills | ${formatSize(totalSize)}`)}\n`,
	);
}
