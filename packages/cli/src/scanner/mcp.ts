import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type McpTransport = "stdio" | "http" | "sse" | "unknown";

export type McpScope = "user" | "project" | "settings" | "mcp-json";

export interface McpServerConfig {
	name: string;
	scope: McpScope;
	transport: McpTransport;
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	url?: string;
}

export type McpMeasureStatus = "ok" | "timeout" | "failed" | "unsupported";

export interface McpServerMeasurement {
	name: string;
	scope: McpScope;
	transport: McpTransport;
	status: McpMeasureStatus;
	toolCount: number;
	chars: number;
	reason?: string;
}

interface RawServerEntry {
	type?: string;
	transport?: string;
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	url?: string;
}

function detectTransport(entry: RawServerEntry): McpTransport {
	const declared = (entry.type ?? entry.transport ?? "").toLowerCase();
	if (declared === "stdio" || declared === "http" || declared === "sse")
		return declared;
	if (entry.command) return "stdio";
	if (entry.url) return "http";
	return "unknown";
}

function toConfig(
	name: string,
	entry: RawServerEntry,
	scope: McpScope,
): McpServerConfig {
	return {
		name,
		scope,
		transport: detectTransport(entry),
		command: entry.command,
		args: entry.args,
		env: entry.env,
		url: entry.url,
	};
}

function readJson(path: string): Record<string, unknown> | null {
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function collectFrom(
	raw: unknown,
	scope: McpScope,
	into: Map<string, McpServerConfig>,
): void {
	if (!raw || typeof raw !== "object") return;
	for (const [name, entry] of Object.entries(
		raw as Record<string, RawServerEntry>,
	)) {
		if (!entry || typeof entry !== "object") continue;
		// Server names are matched case-insensitively so the same server
		// declared as "alphaXiv" in one scope and "alphaxiv" in another is
		// probed and billed once, not twice.
		const key = name.toLowerCase();
		if (into.has(key)) continue;
		into.set(key, toConfig(name, entry, scope));
	}
}

/**
 * Discover MCP servers across every scope Claude Code reads.
 *
 * Precedence (first wins, matching Claude Code's own resolution order):
 *   1. project scope   — ~/.claude.json -> .projects[cwd].mcpServers
 *   2. repo scope      — <cwd>/.mcp.json -> .mcpServers
 *   3. settings scope  — ~/.claude/settings.json -> .mcpServers
 *   4. user scope      — ~/.claude.json -> .mcpServers
 */
export function discoverMcpServers(
	cwd: string = process.cwd(),
): McpServerConfig[] {
	const found = new Map<string, McpServerConfig>();

	const claudeJson = readJson(join(homedir(), ".claude.json"));

	if (claudeJson) {
		const projects = claudeJson.projects as
			| Record<string, { mcpServers?: unknown }>
			| undefined;
		const projectEntry = projects?.[cwd];
		collectFrom(projectEntry?.mcpServers, "project", found);
	}

	const repoMcpJson = readJson(join(cwd, ".mcp.json"));
	collectFrom(repoMcpJson?.mcpServers, "mcp-json", found);

	const settings = readJson(join(homedir(), ".claude", "settings.json"));
	collectFrom(settings?.mcpServers, "settings", found);

	collectFrom(claudeJson?.mcpServers, "user", found);

	return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

interface JsonRpcMessage {
	id?: number;
	method?: string;
	result?: { tools?: unknown[] };
	error?: { message?: string };
}

/**
 * A JSON-RPC *response* carries `result` or `error` and never `method`.
 * Guarding on this matters: a server that echoes stdin back (or any pipe-like
 * process such as `cat`) would otherwise replay our own requests, and the
 * echoed `tools/list` would be read as a successful reply with zero tools —
 * reporting a broken server as costing nothing.
 */
/**
 * Pick the most explanatory line out of a server's stderr.
 *
 * The last line is often noise — a version banner, a runtime footer, a blank
 * continuation — so prefer a line that actually reads like a failure, and fall
 * back to the exit code rather than surfacing something misleading.
 */
export function pickFailureReason(stderr: string, code: number | null): string {
	const lines = stderr
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);

	const errorish =
		/error|cannot|can't|not found|denied|refused|unsupported|required|missing|invalid|fatal|unauthorized|EACCES|ENOENT|throw/i;
	const chosen = [...lines].reverse().find((l) => errorish.test(l)) ?? "";

	if (!chosen) {
		return code === null
			? "server exited without output"
			: `exited with code ${code}`;
	}
	return chosen.length > 160 ? `${chosen.slice(0, 157)}...` : chosen;
}

function isResponse(msg: JsonRpcMessage): boolean {
	return (
		msg.method === undefined &&
		(msg.result !== undefined || msg.error !== undefined)
	);
}

/**
 * Measure one stdio MCP server by performing a real handshake and reading
 * back its tool definitions. Tool schemas do not exist on disk — they are
 * only produced at runtime — so this spawns the server, asks for tools/list,
 * and tears it down.
 *
 * Never returns a fabricated 0: a server that fails, times out, or cannot be
 * spoken to is reported with a non-"ok" status so callers can label it as
 * unmeasured rather than free.
 */
export function measureMcpServer(
	config: McpServerConfig,
	timeoutMs = 20_000,
): Promise<McpServerMeasurement> {
	const base: McpServerMeasurement = {
		name: config.name,
		scope: config.scope,
		transport: config.transport,
		status: "unsupported",
		toolCount: 0,
		chars: 0,
	};

	if (config.transport !== "stdio" || !config.command) {
		return Promise.resolve({
			...base,
			reason:
				config.transport === "unknown"
					? "unrecognized transport"
					: `${config.transport} transport not measurable offline`,
		});
	}

	return new Promise((resolve) => {
		let child: ReturnType<typeof spawn>;
		try {
			child = spawn(config.command as string, config.args ?? [], {
				stdio: ["pipe", "pipe", "pipe"],
				env: { ...process.env, ...config.env },
			});
		} catch (err) {
			resolve({ ...base, status: "failed", reason: (err as Error).message });
			return;
		}

		let settled = false;
		let buffer = "";
		let stderrTail = "";

		const finish = (result: McpServerMeasurement) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			try {
				child.kill("SIGTERM");
			} catch {}
			resolve(result);
		};

		const timer = setTimeout(() => {
			finish({
				...base,
				status: "timeout",
				reason: `no tools/list response in ${Math.round(timeoutMs / 1000)}s`,
			});
		}, timeoutMs);

		const send = (msg: unknown) => {
			try {
				child.stdin?.write(`${JSON.stringify(msg)}\n`);
			} catch {}
		};

		child.stdout?.on("data", (chunk: Buffer) => {
			buffer += chunk.toString();
			let idx = buffer.indexOf("\n");
			while (idx >= 0) {
				const line = buffer.slice(0, idx).trim();
				buffer = buffer.slice(idx + 1);
				idx = buffer.indexOf("\n");
				if (!line) continue;

				let msg: JsonRpcMessage;
				try {
					msg = JSON.parse(line) as JsonRpcMessage;
				} catch {
					continue;
				}

				if (!isResponse(msg)) continue;

				if (msg.id === 1) {
					if (msg.error) {
						finish({
							...base,
							status: "failed",
							reason: msg.error.message ?? "initialize failed",
						});
						return;
					}
					send({ jsonrpc: "2.0", method: "notifications/initialized" });
					send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
				}

				if (msg.id === 2) {
					if (msg.error) {
						finish({
							...base,
							status: "failed",
							reason: msg.error.message ?? "tools/list failed",
						});
						return;
					}
					const tools = msg.result?.tools;
					if (!Array.isArray(tools)) {
						finish({
							...base,
							status: "failed",
							reason: "tools/list returned no tool list",
						});
						return;
					}
					finish({
						...base,
						status: "ok",
						toolCount: tools.length,
						chars: JSON.stringify(tools).length,
					});
					return;
				}
			}
		});

		child.stderr?.on("data", (chunk: Buffer) => {
			stderrTail = (stderrTail + chunk.toString()).slice(-300);
		});

		child.on("error", (err) => {
			finish({ ...base, status: "failed", reason: err.message });
		});

		child.on("exit", (code) => {
			if (settled) return;
			finish({
				...base,
				status: "failed",
				reason: pickFailureReason(stderrTail, code),
			});
		});

		send({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2024-11-05",
				capabilities: {},
				clientInfo: { name: "skillkit", version: "0.11.0" },
			},
		});
	});
}

/** Measure servers with bounded concurrency so we never fork-bomb the machine. */
export async function measureMcpServers(
	configs: McpServerConfig[],
	options: {
		concurrency?: number;
		timeoutMs?: number;
		onProgress?: (done: number, total: number) => void;
	} = {},
): Promise<McpServerMeasurement[]> {
	const { concurrency = 4, timeoutMs = 20_000, onProgress } = options;
	const results: McpServerMeasurement[] = new Array(configs.length);
	let cursor = 0;
	let done = 0;

	const worker = async () => {
		while (true) {
			const index = cursor++;
			const config = configs[index];
			if (!config) return;
			results[index] = await measureMcpServer(config, timeoutMs);
			done++;
			onProgress?.(done, configs.length);
		}
	};

	await Promise.all(
		Array.from({ length: Math.min(concurrency, configs.length) }, () =>
			worker(),
		),
	);

	return results;
}
