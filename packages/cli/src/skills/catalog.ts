import coreCommands from "../skill-data/core/references/commands.md" with {
	type: "text",
};
import coreSkill from "../skill-data/core/SKILL.md" with { type: "text" };

export interface BundledSkill {
	name: string;
	description: string;
	version: string;
	content: string;
	references: Array<{ path: string; content: string }>;
}

function frontmatterValue(content: string, key: string): string {
	const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
	return match?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

export const BUNDLED_SKILLS: BundledSkill[] = [
	{
		name: frontmatterValue(coreSkill, "name"),
		description: frontmatterValue(coreSkill, "description"),
		version: frontmatterValue(coreSkill, "version"),
		content: coreSkill.trim(),
		references: [
			{
				path: "references/commands.md",
				content: coreCommands.trim(),
			},
		],
	},
];

export function getBundledSkill(name: string): BundledSkill | undefined {
	return BUNDLED_SKILLS.find((skill) => skill.name === name);
}

export function renderBundledSkill(skill: BundledSkill, full: boolean): string {
	if (!full || skill.references.length === 0) return `${skill.content}\n`;
	const references = skill.references
		.map(
			(reference) => `\n\n---\n\n# ${reference.path}\n\n${reference.content}`,
		)
		.join("");
	return `${skill.content}${references}\n`;
}
