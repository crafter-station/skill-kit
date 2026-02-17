export interface InstalledSkill {
	name: string;
	path: string;
	description: string;
	size: number;
	installedAt: string;
}

export interface SkillInvocation {
	skillName: string;
	timestamp: string;
	sessionId: string;
	project: string;
}

export interface SkillStats {
	name: string;
	count: number;
	dailyCounts: number[];
}
