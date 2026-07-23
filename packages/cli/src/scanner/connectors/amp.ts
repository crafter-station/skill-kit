import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { ProgressReporter } from "../../tui/progress";
import type { Invocation } from "../index";
import { recordNewInvocations } from "../index";
import type { ScanCache } from "../scan-cache";

const AMP_INTERNAL_TOOLS = new Set([
	"skill",
	"shell_command",
	"async_shell_command",
	"shell_command_status",
	"apply_patch",
	"edit_file",
	"create_file",
	"undo_edit",
	"read_file",
	"Read",
	"Grep",
	"glob",
	"list_directory",
	"get_diagnostics",
	"oracle",
	"codebase_search_agent",
	"Task",
	"todo_write",
	"todo_read",
	"mermaid",
	"web_search",
	"read_web_page",
	"find_thread",
	"download_thread_file",
	"upload_thread_file",
	"load_plugin",
]);

function isInternalTool(name: string): boolean {
	return (
		AMP_INTERNAL_TOOLS.has(name) ||
		name.startsWith("mcp__") ||
		name.startsWith("mcp_")
	);
}

const SKILL_PATH_RE = /skills\/([^/]+)\/SKILL\.md/;

function extractSkillFromArgs(args: string): string | null {
	const match = SKILL_PATH_RE.exec(args);
	return match ? match[1] : null;
}

interface AmpToolUseBlock {
	type?: string;
	name?: string;
	input?: Record<string, unknown>;
}

interface AmpMessage {
	role?: string;
	content?: AmpToolUseBlock[];
	meta?: { sentAt?: number };
	usage?: { timestamp?: string };
}

interface AmpThread {
	v?: number;
	id?: string;
	created?: number;
	messages?: AmpMessage[];
}

function toIso(epochMs: number): string {
	return new Date(epochMs).toISOString();
}

export function parseAmpSessionFile(
	filePath: string,
	knownSkills: Set<string> = new Set(),
): Invocation[] {
	const results: Invocation[] = [];

	let content: string;
	try {
		content = readFileSync(filePath, "utf-8");
	} catch {
		return results;
	}

	let thread: AmpThread;
	try {
		thread = JSON.parse(content) as AmpThread;
	} catch {
		return results;
	}

	if (typeof thread !== "object" || thread === null) return results;

	const threadId =
		typeof thread.id === "string" ? thread.id : basename(filePath, ".json");
	const sessionId = `amp:${threadId}`;
	const fallbackTs =
		typeof thread.created === "number"
			? toIso(thread.created)
			: new Date().toISOString();

	if (!Array.isArray(thread.messages)) return results;

	for (const msg of thread.messages) {
		if (typeof msg !== "object" || msg === null) continue;
		if (msg.role !== "assistant") continue;
		if (!Array.isArray(msg.content)) continue;

		const timestamp =
			typeof msg.usage?.timestamp === "string"
				? msg.usage.timestamp
				: typeof msg.meta?.sentAt === "number"
					? toIso(msg.meta.sentAt)
					: fallbackTs;

		for (const block of msg.content) {
			if (typeof block !== "object" || block === null) continue;
			if (block.type !== "tool_use") continue;
			const name = typeof block.name === "string" ? block.name : undefined;
			if (!name) continue;

			if (name === "skill") {
				const skillName = block.input?.name;
				if (typeof skillName === "string" && skillName) {
					results.push({
						skillName,
						timestamp,
						sessionId,
						agent: "amp",
					});
				}
				continue;
			}

			if (isInternalTool(name)) {
				let args = "";
				try {
					args = JSON.stringify(block.input ?? {});
				} catch {
					continue;
				}
				const skillName = extractSkillFromArgs(args);
				if (skillName) {
					results.push({
						skillName,
						timestamp,
						sessionId,
						agent: "amp",
					});
				}
				continue;
			}

			if (knownSkills.has(name)) {
				results.push({
					skillName: name,
					timestamp,
					sessionId,
					agent: "amp",
				});
			}
		}
	}

	return results;
}

function ampThreadsDir(): string {
	const dataHome =
		process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
	return join(dataHome, "amp", "threads");
}

export function countAmpSessions(): number {
	const threadsDir = ampThreadsDir();
	if (!existsSync(threadsDir)) return 0;

	let count = 0;
	const glob = new Bun.Glob("*.json");
	for (const _ of glob.scanSync({ cwd: threadsDir })) {
		count++;
	}
	return count;
}

export async function scanAmpSessions(
	db: Database,
	trackedSet: Set<string>,
	knownSkills: Set<string> = new Set(),
	cache?: ScanCache,
	progress?: ProgressReporter,
): Promise<number> {
	const threadsDir = ampThreadsDir();
	if (!existsSync(threadsDir)) return 0;

	const glob = new Bun.Glob("*.json");
	const files: string[] = [];
	for await (const file of glob.scan({ cwd: threadsDir, absolute: true })) {
		files.push(file);
	}

	let total = 0;
	let done = 0;
	for (const file of files) {
		done++;
		if (cache?.shouldSkip(file)) {
			progress?.update(done, files.length);
			continue;
		}
		const invocations = parseAmpSessionFile(file, knownSkills);
		total += recordNewInvocations(db, trackedSet, invocations);
		progress?.update(done, files.length);
	}
	progress?.finish();

	return total;
}
