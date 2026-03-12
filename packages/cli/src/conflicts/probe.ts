import type { DiscoveredSkill } from "./discovery";

export interface Probe {
	prompt: string;
	expectedSkill: string;
	type: "ambiguous" | "clear";
	pairSkills?: [string, string];
}

export function generateProbes(
	skills: DiscoveredSkill[],
	pairs: Array<{ a: DiscoveredSkill; b: DiscoveredSkill; similarity: number }>,
	ambiguousPerPair = 3,
	clearPerSkill = 2,
): Probe[] {
	const probes: Probe[] = [];

	for (const { a, b } of pairs) {
		const sharedKeywords = a.keywords.filter((k) => b.keywords.includes(k));
		const ambiguous = generateAmbiguousPrompts(a, b, sharedKeywords, ambiguousPerPair);
		probes.push(...ambiguous);
	}

	for (const skill of skills) {
		const uniqueKeywords = skill.keywords.filter(
			(k) => !skills.some((other) => other.name !== skill.name && other.keywords.includes(k)),
		);
		const clear = generateClearPrompts(skill, uniqueKeywords, clearPerSkill);
		probes.push(...clear);
	}

	return probes;
}

function generateAmbiguousPrompts(
	a: DiscoveredSkill,
	b: DiscoveredSkill,
	sharedKeywords: string[],
	count: number,
): Probe[] {
	const templates = [
		(kws: string[]) => `${kws.join(" ")} the changes`,
		(kws: string[]) => `please ${kws[0] ?? "help"} and ${kws[1] ?? "process"} this`,
		(kws: string[]) => `can you ${kws.join(" or ")} this for me`,
		(kws: string[]) => `I need to ${kws[0] ?? "do"} something with ${kws[1] ?? "this"}`,
		(kws: string[]) => `${kws[0] ?? "handle"} this ${kws[1] ?? "task"} now`,
	];

	const probes: Probe[] = [];
	const kws = sharedKeywords.length > 0 ? sharedKeywords : [...a.keywords.slice(0, 1), ...b.keywords.slice(0, 1)];

	for (let i = 0; i < Math.min(count, templates.length); i++) {
		probes.push({
			prompt: templates[i]!(kws),
			expectedSkill: a.name,
			type: "ambiguous",
			pairSkills: [a.name, b.name],
		});
	}

	return probes;
}

function generateClearPrompts(
	skill: DiscoveredSkill,
	uniqueKeywords: string[],
	count: number,
): Probe[] {
	const kws = uniqueKeywords.length > 0 ? uniqueKeywords : skill.keywords;
	const templates = [
		(kws: string[]) => `/${skill.name} ${kws.slice(0, 2).join(" ")}`,
		(kws: string[]) => `use ${skill.name} to ${kws[0] ?? "process"} this`,
		(kws: string[]) => `${kws.slice(0, 3).join(" ")}`,
	];

	const probes: Probe[] = [];
	for (let i = 0; i < Math.min(count, templates.length); i++) {
		probes.push({
			prompt: templates[i]!(kws),
			expectedSkill: skill.name,
			type: "clear",
		});
	}

	return probes;
}
