import { scanInstalledSkills } from "../scanner/skills";
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

	const agentCounts = new Map<string, number>();
	for (const s of skills) {
		agentCounts.set(s.agent, (agentCounts.get(s.agent) ?? 0) + 1);
	}

	const totalSize = skills.reduce((acc, s) => acc + s.size, 0);

	console.log(`\n  ${bold(`INSTALLED SKILLS (${skills.length})`)}\n`);

	const nameWidth = 24;
	const descWidth = 42;
	const sizeWidth = 10;

	const header = `  ${"NAME".padEnd(nameWidth)}${"DESCRIPTION".padEnd(descWidth)}${"SIZE".padStart(sizeWidth)}`;
	console.log(dim(header));

	for (const skill of skills) {
		const name = cyan(skill.name.padEnd(nameWidth));
		const desc = dim(
			truncate(skill.description || "", descWidth).padEnd(descWidth),
		);
		const size = formatSize(skill.size).padStart(sizeWidth);
		console.log(`  ${name}${desc}${size}`);
	}

	const agentSummary = [...agentCounts.entries()]
		.map(([a, c]) => `${a} (${c})`)
		.join(", ");
	console.log(
		`\n  ${dim(`Total: ${skills.length} skills | ${formatSize(totalSize)} | ${agentSummary}`)}\n`,
	);
}
