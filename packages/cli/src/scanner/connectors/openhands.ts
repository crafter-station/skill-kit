import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { ProgressReporter } from "../../tui/progress";
import type { Invocation } from "../index";
import { recordNewInvocations } from "../index";
import type { ScanCache } from "../scan-cache";

const OPENHANDS_INTERNAL_TOOLS = new Set([
	"terminal",
	"execute_bash",
	"str_replace_editor",
	"file_editor",
	"browser",
	"browser_use",
	"task_tracker",
	"finish",
	"think",
	"planning_file_editor",
	"glob",
	"grep",
]);

function isInternalTool(name: string): boolean {
	return (
		OPENHANDS_INTERNAL_TOOLS.has(name) ||
		name.startsWith("mcp__") ||
		name.startsWith("mcp_")
	);
}

const SKILL_PATH_RE = /skills\/([^/]+)\/SKILL\.md/;

function extractSkillFromArgs(args: string): string | null {
	const match = SKILL_PATH_RE.exec(args);
	return match ? (match[1] ?? null) : null;
}

/**
 * Stable id for one event file.
 *
 * Both layouts name the file after the event, so the basename identifies the
 * event even when the JSON carries no id of its own.
 */
function eventIdForEventFile(filePath: string): string {
	return basename(filePath).replace(/\.json$/, "");
}

function sessionIdForEventFile(filePath: string): string {
	const parent = dirname(filePath);
	// CLI/SDK layout: <conversations>/<cid>/events/event-*.json
	// App server layout: <v1_conversations>/<cid_hex>/<event_id>.json
	const conversationDir =
		basename(parent) === "events" ? dirname(parent) : parent;
	return `openhands:${basename(conversationDir)}`;
}

export function parseOpenHandsEventFile(
	filePath: string,
	knownSkills: Set<string> = new Set(),
): Invocation[] {
	const results: Invocation[] = [];
	const sessionId = sessionIdForEventFile(filePath);

	let content: string;
	try {
		content = readFileSync(filePath, "utf-8");
	} catch {
		return results;
	}

	let event: unknown;
	try {
		event = JSON.parse(content);
	} catch {
		return results;
	}

	if (typeof event !== "object" || event === null) return results;
	const obj = event as Record<string, unknown>;

	const timestamp =
		typeof obj.timestamp === "string"
			? obj.timestamp
			: new Date().toISOString();
	const kind = obj.kind as string | undefined;
	const baseEventId =
		typeof obj.id === "string" && obj.id ? obj.id : eventIdForEventFile(filePath);

	if (kind === "MessageEvent") {
		const activated = obj.activated_skills;
		if (Array.isArray(activated)) {
			const seen = new Set<string>();
			for (const name of activated) {
				if (typeof name !== "string" || seen.has(name)) continue;
				seen.add(name);
				results.push({
					skillName: name,
					timestamp,
					sessionId,
					agent: "openhands",
					eventId: `${baseEventId}#${name}`,
				});
			}
		}
		return results;
	}

	if (kind === "ActionEvent") {
		const toolName = obj.tool_name as string | undefined;

		let args = "";
		const toolCall = obj.tool_call as Record<string, unknown> | undefined;
		if (toolCall && typeof toolCall.arguments === "string") {
			args = toolCall.arguments;
		} else if (obj.action !== undefined) {
			try {
				args = JSON.stringify(obj.action);
			} catch {
				args = "";
			}
		}

		const fromPath = extractSkillFromArgs(args);
		if (fromPath) {
			results.push({
				skillName: fromPath,
				timestamp,
				sessionId,
				agent: "openhands",
				eventId: baseEventId,
			});
			return results;
		}

		if (toolName && !isInternalTool(toolName) && knownSkills.has(toolName)) {
			results.push({
				skillName: toolName,
				timestamp,
				sessionId,
				agent: "openhands",
				eventId: baseEventId,
			});
		}
	}

	return results;
}

const EVENT_GLOBS = [
	"conversations/*/events/event-*.json",
	"v1_conversations/*/*.json",
];

function openHandsRoot(): string {
	return join(homedir(), ".openhands");
}

export function countOpenHandsSessions(): number {
	const root = openHandsRoot();
	if (!existsSync(root)) return 0;

	const sessions = new Set<string>();
	for (const pattern of EVENT_GLOBS) {
		const glob = new Bun.Glob(pattern);
		for (const file of glob.scanSync({ cwd: root })) {
			sessions.add(sessionIdForEventFile(join(root, file)));
		}
	}
	return sessions.size;
}

export async function scanOpenHandsSessions(
	db: Database,
	trackedSet: Set<string>,
	knownSkills: Set<string> = new Set(),
	cache?: ScanCache,
	progress?: ProgressReporter,
): Promise<number> {
	const root = openHandsRoot();
	if (!existsSync(root)) return 0;

	const files: string[] = [];
	for (const pattern of EVENT_GLOBS) {
		const glob = new Bun.Glob(pattern);
		for await (const file of glob.scan({ cwd: root, absolute: true })) {
			files.push(file);
		}
	}

	let total = 0;
	let done = 0;
	for (const file of files) {
		done++;
		if (cache?.shouldSkip(file)) {
			progress?.update(done, files.length);
			continue;
		}
		const invocations = parseOpenHandsEventFile(file, knownSkills);
		total += recordNewInvocations(db, trackedSet, invocations);
		progress?.update(done, files.length);
	}
	progress?.finish();

	return total;
}
