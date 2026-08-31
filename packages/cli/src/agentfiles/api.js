import {
	existsSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const AGENTFILES_SNAPSHOT_TEMP_PREFIX = "agentfiles-snapshot-";
const DASHBOARD_KEYS = ["stats", "health", "burn", "context"];

function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTrace(value) {
	return (
		isObject(value) &&
		typeof value.traceId === "string" &&
		typeof value.timestamp === "string" &&
		typeof value.tokens === "number" &&
		typeof value.cost === "number" &&
		typeof value.duration === "number" &&
		typeof value.model === "string"
	);
}

function isConflict(value) {
	return (
		isObject(value) &&
		typeof value.skillName === "string" &&
		typeof value.similarity === "number"
	);
}

function isSkillDetails(value) {
	return (
		isObject(value) &&
		Array.isArray(value.traces) &&
		value.traces.every(isTrace) &&
		Array.isArray(value.conflicts) &&
		value.conflicts.every(isConflict)
	);
}

export const AGENTFILES_SNAPSHOT_PATH = join(
	homedir(),
	".skillkit",
	"agentfiles-snapshot.json",
);

export function parseAgentfilesSnapshot(input) {
	try {
		const parsed = JSON.parse(input);
		if (
			parsed?.version !== 1 ||
			typeof parsed.generatedAt !== "string" ||
			!isObject(parsed.dashboard) ||
			!DASHBOARD_KEYS.every((key) => Object.hasOwn(parsed.dashboard, key)) ||
			!isObject(parsed.skills) ||
			!Object.values(parsed.skills).every(isSkillDetails)
		)
			return null;
		return parsed;
	} catch {
		return null;
	}
}

export function loadAgentfilesSnapshot(path = AGENTFILES_SNAPSHOT_PATH) {
	if (!existsSync(path)) return null;
	try {
		return parseAgentfilesSnapshot(readFileSync(path, "utf-8"));
	} catch {
		return null;
	}
}

export function clearAgentfilesSnapshotTemps(
	path = AGENTFILES_SNAPSHOT_PATH,
	minimumAgeMs = 86_400_000,
) {
	const directory = dirname(path);
	if (!existsSync(directory)) return;
	for (const name of readdirSync(directory)) {
		if (
			!name.startsWith(AGENTFILES_SNAPSHOT_TEMP_PREFIX) ||
			!name.endsWith(".tmp")
		)
			continue;
		const temporaryPath = join(directory, name);
		let modifiedAt;
		try {
			modifiedAt = statSync(temporaryPath).mtimeMs;
		} catch {
			continue;
		}
		if (Date.now() - modifiedAt < minimumAgeMs) continue;
		rmSync(temporaryPath, { force: true });
	}
}

export function clearAgentfilesSnapshot(path = AGENTFILES_SNAPSHOT_PATH) {
	rmSync(path, { force: true });
	clearAgentfilesSnapshotTemps(path);
}
