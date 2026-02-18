import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getTopSkills } from "../db/queries";
import { getDb } from "../db/schema";
import { getDetectedAgents, scanInstalledSkills } from "../scanner/skills";
import { bold, dim, green, red, yellow } from "../tui/colors";

const METADATA_BUDGET = 16000;
const BODY_LINE_LIMIT = 500;

function check(label: string) {
	return `  ${green("✓")} ${label}`;
}

function warn(label: string) {
	return `  ${yellow("⚠")} ${label}`;
}

function info(label: string) {
	return `  ${dim("●")} ${label}`;
}

function parseFrontmatter(content: string): {
	name: string;
	description: string;
	bodyLines: number;
} {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match)
		return { name: "", description: "", bodyLines: content.split("\n").length };

	const yaml = match[1] ?? "";
	const body = content.slice(match[0].length);
	const bodyLines = body.trim() ? body.trim().split("\n").length : 0;

	let name = "";
	let description = "";

	const nameMatch = yaml.match(/^name:\s*(.+)$/m);
	if (nameMatch?.[1]) name = nameMatch[1].trim().replace(/^["']|["']$/g, "");

	const descMatch = yaml.match(/^description:\s*(.+)$/m);
	if (descMatch?.[1])
		description = descMatch[1].trim().replace(/^["']|["']$/g, "");

	return { name, description, bodyLines };
}

export async function runHealth(): Promise<void> {
	const skills = scanInstalledSkills();
	const dbPath = join(homedir(), ".skillkit", "analytics.db");
	const dbExists = existsSync(dbPath);

	let totalMetadataChars = 0;
	let totalBodyChars = 0;
	const oversizedSkills: Array<{ name: string; lines: number }> = [];
	const longDescSkills: Array<{ name: string; chars: number }> = [];

	for (const skill of skills) {
		const skillMdPath = join(skill.path, "SKILL.md");
		if (!existsSync(skillMdPath)) continue;
		try {
			const content = readFileSync(skillMdPath, "utf-8");
			const fm = parseFrontmatter(content);

			const metadataSize =
				(fm.name || skill.name).length + fm.description.length;
			totalMetadataChars += metadataSize;
			totalBodyChars += content.length;

			if (fm.bodyLines > BODY_LINE_LIMIT) {
				oversizedSkills.push({
					name: fm.name || skill.name,
					lines: fm.bodyLines,
				});
			}
			if (fm.description.length > 1024) {
				longDescSkills.push({
					name: fm.name || skill.name,
					chars: fm.description.length,
				});
			}
		} catch {}
	}

	let eventCount = 0;
	let neverUsed: string[] = [];
	let hasDbData = false;

	if (dbExists) {
		const db = getDb();
		const row = db
			.query<{ count: number }, []>(
				"SELECT COUNT(*) as count FROM skill_invocations",
			)
			.get();
		eventCount = row?.count ?? 0;
		hasDbData = eventCount > 0;

		if (hasDbData) {
			const topSkills = getTopSkills(db, 365);
			const usedNames = new Set(topSkills.map((s) => s.skill_name));
			neverUsed = skills
				.filter((s) => !usedNames.has(s.name))
				.map((s) => s.name);
		}
	}

	const metadataPct = Math.min(
		100,
		Math.round((totalMetadataChars / METADATA_BUDGET) * 100),
	);

	console.log(`\n  ${bold("SKILLKIT HEALTH REPORT")}\n`);

	const agents = getDetectedAgents();
	console.log(check(`${skills.length} skills installed`));
	if (agents.length > 0) {
		console.log(dim(`    ${agents.join(" + ")}`));
	}

	if (dbExists && hasDbData) {
		console.log(
			check(`Analytics DB: ${eventCount.toLocaleString()} events tracked`),
		);
	} else if (dbExists) {
		console.log(warn("Analytics DB exists but has no data"));
		console.log(dim("    Run: skillkit scan"));
	} else {
		console.log(warn("Analytics DB not found"));
		console.log(dim("    Run: skillkit scan"));
	}

	if (neverUsed.length > 0) {
		console.log();
		console.log(warn(`${neverUsed.length} skills never used in 30d`));
		const preview = neverUsed.slice(0, 5).join(", ");
		const more = neverUsed.length > 5 ? ` +${neverUsed.length - 5} more` : "";
		console.log(`    ${dim(preview + more)}`);
		console.log(`    ${dim("Run: skillkit prune")}`);
	}

	console.log();
	const metaKb = (totalMetadataChars / 1000).toFixed(1);
	const budgetKb = (METADATA_BUDGET / 1000).toFixed(1);

	const filled = Math.round(Math.min(metadataPct, 100) / 10);
	const empty = 10 - filled;
	const barFill = "█".repeat(filled);
	const barEmpty = "░".repeat(empty);
	const colorBar =
		metadataPct >= 90
			? red(barFill)
			: metadataPct >= 70
				? yellow(barFill)
				: green(barFill);
	const bar = `[${colorBar}${dim(barEmpty)}]`;

	console.log(
		`  ${bar} ${bold(`${metadataPct}%`)} metadata budget ${dim(`(${metaKb}K / ${budgetKb}K)`)}`,
	);
	console.log(
		`    ${dim("name + description of each skill, loaded at startup")}`,
	);

	const bodyKb = (totalBodyChars / 1000).toFixed(1);
	console.log(info(`Total skill content: ${bodyKb}K chars (loaded on-demand)`));

	if (oversizedSkills.length > 0) {
		console.log();
		console.log(
			warn(
				`${oversizedSkills.length} skills exceed ${BODY_LINE_LIMIT}-line recommendation`,
			),
		);
		for (const s of oversizedSkills.slice(0, 5)) {
			console.log(`    ${dim(`${s.name}: ${s.lines} lines`)}`);
		}
		if (oversizedSkills.length > 5) {
			console.log(`    ${dim(`+${oversizedSkills.length - 5} more`)}`);
		}
		console.log(
			`    ${dim("Split large SKILL.md into referenced files for progressive disclosure")}`,
		);
	}

	if (longDescSkills.length > 0) {
		console.log();
		console.log(
			warn(`${longDescSkills.length} skills have descriptions over 1024 chars`),
		);
		for (const s of longDescSkills.slice(0, 3)) {
			console.log(`    ${dim(`${s.name}: ${s.chars} chars`)}`);
		}
	}

	console.log();
}
