import type { TraceResult } from "../trace/engine";
import type { Probe } from "./probe";

export interface CollisionResult {
	probe: Probe;
	firedSkill: string | null;
	matched: boolean;
	type: "correct" | "wrong_skill" | "no_skill" | "ambiguous_correct";
}

export interface ConflictSummary {
	totalProbes: number;
	totalSkills: number;
	correct: number;
	wrongSkill: CollisionResult[];
	noSkill: CollisionResult[];
	ambiguousCorrect: CollisionResult[];
}

export function analyzeCollision(probe: Probe, trace: TraceResult): CollisionResult {
	const firedSkill = trace.skillName;

	if (!firedSkill) {
		return {
			probe,
			firedSkill: null,
			matched: false,
			type: "no_skill",
		};
	}

	const firedLower = firedSkill.toLowerCase();
	const expectedLower = probe.expectedSkill.toLowerCase();

	if (firedLower === expectedLower || firedLower.includes(expectedLower) || expectedLower.includes(firedLower)) {
		return {
			probe,
			firedSkill,
			matched: true,
			type: probe.type === "ambiguous" ? "ambiguous_correct" : "correct",
		};
	}

	if (probe.type === "ambiguous" && probe.pairSkills) {
		const isOneOfPair = probe.pairSkills.some(
			(s) => firedLower === s.toLowerCase() || firedLower.includes(s.toLowerCase()),
		);
		if (isOneOfPair) {
			return {
				probe,
				firedSkill,
				matched: false,
				type: "wrong_skill",
			};
		}
	}

	return {
		probe,
		firedSkill,
		matched: false,
		type: "wrong_skill",
	};
}

export function summarizeConflicts(results: CollisionResult[], totalSkills: number): ConflictSummary {
	return {
		totalProbes: results.length,
		totalSkills,
		correct: results.filter((r) => r.type === "correct").length,
		wrongSkill: results.filter((r) => r.type === "wrong_skill"),
		noSkill: results.filter((r) => r.type === "no_skill"),
		ambiguousCorrect: results.filter((r) => r.type === "ambiguous_correct"),
	};
}
