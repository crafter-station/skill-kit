import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	discoverAllSkills,
	findOverlappingPairs,
} from "../conflicts/discovery";
import { getDb } from "../db/schema";
import { getRecentTraces } from "../trace/store";
import {
	AGENTFILES_SNAPSHOT_PATH,
	AGENTFILES_SNAPSHOT_TEMP_PREFIX,
	clearAgentfilesSnapshotTemps,
	type AgentfilesJsonValue,
	type AgentfilesSnapshot,
} from "./api.js";

export function parseCapturedJson(output: string): AgentfilesJsonValue {
	const objectStart = output.indexOf("{");
	const arrayStart = output.indexOf("[");
	const start =
		objectStart === -1
			? arrayStart
			: arrayStart === -1
				? objectStart
				: Math.min(objectStart, arrayStart);
	if (start === -1) return null;
	try {
		return JSON.parse(output.slice(start)) as AgentfilesJsonValue;
	} catch {
		return null;
	}
}

async function captureJson(
	command: () => Promise<void>,
	args: string[],
): Promise<AgentfilesJsonValue> {
	const originalArgv = process.argv;
	const originalLog = console.log;
	const originalError = console.error;
	const output: string[] = [];
	process.argv = [
		originalArgv[0] ?? "bun",
		originalArgv[1] ?? "skillkit",
		"snapshot",
		...args,
		"--json",
	];
	console.log = (...values: unknown[]) =>
		output.push(values.map(String).join(" "));
	console.error = (...values: unknown[]) =>
		output.push(values.map(String).join(" "));
	try {
		await command();
	} finally {
		process.argv = originalArgv;
		console.log = originalLog;
		console.error = originalError;
	}
	return parseCapturedJson(output.join("\n"));
}

function buildSkillDetails(): AgentfilesSnapshot["skills"] {
	const result: AgentfilesSnapshot["skills"] = {};
	const db = getDb();
	for (const trace of getRecentTraces(db, 500)) {
		if (!trace.skill_name) continue;
		const detail = result[trace.skill_name] ?? { traces: [], conflicts: [] };
		if (detail.traces.length < 5) {
			detail.traces.push({
				traceId: trace.trace_id,
				timestamp: trace.timestamp,
				tokens: trace.tokens_total,
				cost: trace.cost_estimate,
				duration: trace.duration_ms,
				model: trace.model,
			});
		}
		result[trace.skill_name] = detail;
	}

	const discovered = discoverAllSkills(process.cwd());
	for (const pair of findOverlappingPairs(discovered, 0.3)) {
		const a = result[pair.a.name] ?? { traces: [], conflicts: [] };
		const b = result[pair.b.name] ?? { traces: [], conflicts: [] };
		a.conflicts.push({ skillName: pair.b.name, similarity: pair.similarity });
		b.conflicts.push({ skillName: pair.a.name, similarity: pair.similarity });
		result[pair.a.name] = a;
		result[pair.b.name] = b;
	}
	return result;
}

export async function createAgentfilesSnapshot(): Promise<AgentfilesSnapshot> {
	const { getStatsJson } = await import("../commands/stats");
	const { runHealth } = await import("../commands/health");
	const { runBurnCommand } = await import("../commands/burn");
	const { runContextCommand } = await import("../commands/context");
	const statsResult = getStatsJson(getDb());
	const stats =
		"error" in statsResult
			? null
			: (JSON.parse(JSON.stringify(statsResult)) as AgentfilesJsonValue);
	const health = await captureJson(runHealth, []);
	const burn = await captureJson(runBurnCommand, []);
	const context = await captureJson(runContextCommand, []);
	return {
		version: 1,
		generatedAt: new Date().toISOString(),
		dashboard: { stats, health, burn, context },
		skills: buildSkillDetails(),
	};
}

export async function writeAgentfilesSnapshot(): Promise<string> {
	const snapshot = await createAgentfilesSnapshot();
	const directory = dirname(AGENTFILES_SNAPSHOT_PATH);
	mkdirSync(directory, { recursive: true });
	clearAgentfilesSnapshotTemps();
	const temporaryPath = join(
		directory,
		`${AGENTFILES_SNAPSHOT_TEMP_PREFIX}${process.pid}-${randomUUID()}.tmp`,
	);
	try {
		writeFileSync(
			temporaryPath,
			`${JSON.stringify(snapshot, null, 2)}\n`,
			"utf-8",
		);
		renameSync(temporaryPath, AGENTFILES_SNAPSHOT_PATH);
	} finally {
		rmSync(temporaryPath, { force: true });
	}
	return AGENTFILES_SNAPSHOT_PATH;
}

export async function runAgentfilesSnapshot(): Promise<void> {
	const path = await writeAgentfilesSnapshot();
	if (!process.argv.includes("--quiet")) console.log(path);
}
