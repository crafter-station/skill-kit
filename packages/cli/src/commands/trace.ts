import { getDb } from "../db/schema";
import { runTrace } from "../trace/engine";
import {
	renderTrace,
	renderTraceFromRow,
	renderTraceJson,
	renderTraceList,
} from "../trace/report";
import { getRecentTraces, getTrace, getTracesBySkill, saveTrace } from "../trace/store";
import { bold, cyan, dim, red, yellow } from "../tui/colors";

function parseModel(args: string[]): string | undefined {
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--model" && args[i + 1]) return args[i + 1]!;
		const match = args[i]?.match(/^--model=(.+)$/);
		if (match) return match[1]!;
	}
	return undefined;
}

function parseTimeout(args: string[]): number {
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--timeout" && args[i + 1]) {
			const n = parseInt(args[i + 1]!, 10);
			if (!isNaN(n) && n > 0) return n;
		}
		const match = args[i]?.match(/^--timeout=(\d+)$/);
		if (match) {
			const n = parseInt(match[1]!, 10);
			if (!isNaN(n) && n > 0) return n;
		}
	}
	return 120;
}

function parseLimit(args: string[]): number {
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--limit" && args[i + 1]) {
			const n = parseInt(args[i + 1]!, 10);
			if (!isNaN(n) && n > 0) return n;
		}
		const match = args[i]?.match(/^--limit=(\d+)$/);
		if (match) {
			const n = parseInt(match[1]!, 10);
			if (!isNaN(n) && n > 0) return n;
		}
	}
	return 10;
}

function extractPrompt(args: string[]): string | null {
	const flags = new Set(["--model", "--timeout", "--limit", "--skill"]);
	const parts: string[] = [];
	for (let i = 0; i < args.length; i++) {
		if (flags.has(args[i] ?? "")) {
			i++;
			continue;
		}
		if (args[i]?.startsWith("--")) continue;
		parts.push(args[i]!);
	}
	return parts.length > 0 ? parts.join(" ") : null;
}

function parseSkillFilter(args: string[]): string | undefined {
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--skill" && args[i + 1]) return args[i + 1]!;
		const match = args[i]?.match(/^--skill=(.+)$/);
		if (match) return match[1]!;
	}
	return undefined;
}

function printTraceHelp(): void {
	console.log(`
  ${bold("skillkit trace")} - Run and record skill execution traces

  ${bold("USAGE")}
    skillkit trace "your prompt here"     Run a trace
    skillkit trace --list                 List recent traces
    skillkit trace --show <trace_id>      Show trace details
    skillkit trace --json <trace_id>      Show trace as JSON

  ${bold("FLAGS")}
    ${cyan("--model <model>")}       Model to use (default: auto)
    ${cyan("--timeout <seconds>")}   Timeout in seconds (default: 120)
    ${cyan("--list")}                List recent traces
    ${cyan("--limit <N>")}           Number of traces to list (default: 10)
    ${cyan("--skill <name>")}        Filter traces by skill name
    ${cyan("--show <trace_id>")}     Show a specific trace
    ${cyan("--json <trace_id>")}     Output trace as JSON
    ${cyan("--help")}                Show this help

  ${bold("EXAMPLES")}
    ${dim("skillkit trace \"commit my changes\"")}
    ${dim("skillkit trace --model claude-sonnet-4-6 \"refactor this file\"")}
    ${dim("skillkit trace --list --limit 20")}
    ${dim("skillkit trace --list --skill commit")}
    ${dim("skillkit trace --show t_abc123")}
`);
}

export async function runTraceCommand(): Promise<void> {
	const args = process.argv.slice(3);

	if (args.includes("--help") || args.includes("-h")) {
		printTraceHelp();
		return;
	}

	const db = getDb();

	if (args.includes("--list")) {
		const limit = parseLimit(args);
		const skillFilter = parseSkillFilter(args);
		const isJson = args.includes("--json");

		const rows = skillFilter
			? getTracesBySkill(db, skillFilter, limit)
			: getRecentTraces(db, limit);

		if (rows.length === 0) {
			if (isJson) {
				console.log(JSON.stringify([]));
			} else {
				console.log(`\n  ${yellow("No traces found.")}`);
				console.log(`  ${dim("Run: skillkit trace \"your prompt\"")}\n`);
			}
			return;
		}

		if (isJson) {
			const output = rows.map((row) => ({
				trace_id: row.trace_id,
				skill_name: row.skill_name,
				tokens_total: row.tokens_total,
				cost_estimate: row.cost_estimate,
				duration_ms: row.duration_ms,
				model: row.model,
				timestamp: row.timestamp,
			}));
			console.log(JSON.stringify(output, null, 2));
			return;
		}

		console.log(renderTraceList(rows));
		return;
	}

	if (args.includes("--show")) {
		const idx = args.indexOf("--show");
		const traceId = args[idx + 1];
		if (!traceId) {
			console.error(`\n  ${red("Missing trace ID.")}`);
			console.error(`  ${dim("Usage: skillkit trace --show <trace_id>")}\n`);
			process.exit(1);
		}

		const row = getTrace(db, traceId);
		if (!row) {
			console.error(`\n  ${red(`Trace not found: ${traceId}`)}\n`);
			process.exit(1);
		}

		console.log(renderTraceFromRow(row));
		return;
	}

	if (args.includes("--json")) {
		const idx = args.indexOf("--json");
		const traceId = args[idx + 1];
		if (!traceId) {
			console.error(`\n  ${red("Missing trace ID.")}`);
			console.error(`  ${dim("Usage: skillkit trace --json <trace_id>")}\n`);
			process.exit(1);
		}

		const row = getTrace(db, traceId);
		if (!row) {
			console.error(`\n  ${red(`Trace not found: ${traceId}`)}\n`);
			process.exit(1);
		}

		const toolCalls = JSON.parse(row.tool_calls);
		const filesRead = row.files_read ? JSON.parse(row.files_read) : [];
		console.log(
			renderTraceJson({
				traceId: row.trace_id,
				skillName: row.skill_name,
				prompt: row.prompt,
				response: row.response ?? "",
				toolCalls,
				filesRead,
				tokensIn: row.tokens_in,
				tokensOut: row.tokens_out,
				tokensTotal: row.tokens_total,
				cacheCreationTokens: row.cache_creation_tokens ?? 0,
				cacheReadTokens: row.cache_read_tokens ?? 0,
				durationMs: row.duration_ms,
				costEstimate: row.cost_estimate,
				model: row.model,
				timestamp: row.timestamp,
			}),
		);
		return;
	}

	const prompt = extractPrompt(args);
	if (!prompt) {
		printTraceHelp();
		return;
	}

	const model = parseModel(args);
	const timeout = parseTimeout(args);
	const debug = args.includes("--debug");

	console.log(`\n  ${bold("TRACING")} ${dim("—")} ${dim(prompt.length > 60 ? `${prompt.slice(0, 60)}...` : prompt)}`);
	console.log(`  ${dim(`model: ${model ?? "auto"}  timeout: ${timeout}s`)}\n`);

	try {
		const trace = await runTrace({ prompt, model, timeout, debug });
		saveTrace(db, trace);
		console.log(renderTrace(trace));
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`\n  ${red(`Trace failed: ${msg}`)}\n`);
		process.exit(1);
	}
}
