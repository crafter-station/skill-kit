import type { TraceResult } from "./engine";
import type { TraceRow } from "./store";
import { bold, cyan, dim, green, red, yellow } from "../tui/colors";

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
	return String(n);
}

function formatCost(usd: number): string {
	if (usd < 0.01) return `$${usd.toFixed(4)}`;
	return `$${usd.toFixed(3)}`;
}

export function renderTrace(trace: TraceResult): string {
	const lines: string[] = [];

	lines.push("");
	lines.push(`  ${bold("TRACE")} ${dim(trace.traceId)} ${dim("—")} ${dim(trace.timestamp.replace("T", " ").slice(0, 19))}`);
	lines.push("");

	const skillLabel = trace.skillName
		? green(trace.skillName)
		: yellow("(none)");
	lines.push(`    Skill fired:  ${skillLabel}`);
	lines.push(`    Duration:     ${bold(formatDuration(trace.durationMs))}`);
	const cacheTotal = trace.cacheCreationTokens + trace.cacheReadTokens;
	const cacheInfo = cacheTotal > 0 ? ` ${dim(`| cache: ${formatTokens(cacheTotal)}`)}` : "";
	lines.push(
		`    Tokens:       ${bold(formatTokens(trace.tokensTotal))} ${dim(`(in: ${formatTokens(trace.tokensIn)} | out: ${formatTokens(trace.tokensOut)}`)}${cacheInfo}${dim(")")}`,
	);
	lines.push(`    Cost:         ${bold(formatCost(trace.costEstimate))}`);
	lines.push(`    Model:        ${dim(trace.model)}`);

	if (trace.toolCalls.length > 0) {
		lines.push("");
		lines.push(`    ${bold(`TOOL CALLS (${trace.toolCalls.length})`)}`);
		lines.push(`    ${"─".repeat(40)}`);

		for (let i = 0; i < trace.toolCalls.length; i++) {
			const tc = trace.toolCalls[i]!;
			const num = String(i + 1).padStart(2);
			const name = cyan(tc.name.padEnd(10));
			const time = dim(`+${formatDuration(tc.timestampMs)}`);

			let detail = "";
			if (tc.name === "Skill") {
				detail = dim(
					`→ ${(tc.input.skill as string) ?? (tc.input.name as string) ?? ""}`,
				);
			} else if (tc.name === "Read") {
				const fp = tc.input.file_path as string;
				if (fp) {
					const short = fp.split("/").slice(-2).join("/");
					detail = dim(`→ ${short}`);
				}
			} else if (tc.name === "Bash") {
				const cmd = tc.input.command as string;
				if (cmd) {
					const short = cmd.length > 40 ? `${cmd.slice(0, 40)}...` : cmd;
					detail = dim(`→ ${short}`);
				}
			} else if (tc.name === "Edit" || tc.name === "Write") {
				const fp = tc.input.file_path as string;
				if (fp) {
					const short = fp.split("/").slice(-2).join("/");
					detail = dim(`→ ${short}`);
				}
			} else if (tc.name === "Grep") {
				const pat = tc.input.pattern as string;
				if (pat) detail = dim(`→ /${pat}/`);
			} else if (tc.name === "Glob") {
				const pat = tc.input.pattern as string;
				if (pat) detail = dim(`→ ${pat}`);
			}

			lines.push(`    ${num}. ${name} ${detail} ${time}`);
		}
	}

	if (trace.filesRead.length > 0) {
		lines.push("");
		lines.push(`    ${bold(`FILES READ (${trace.filesRead.length})`)}`);
		lines.push(`    ${"─".repeat(40)}`);
		for (const fp of trace.filesRead) {
			const short = fp.split("/").slice(-3).join("/");
			lines.push(`    ${dim(short)}`);
		}
	}

	if (trace.response) {
		lines.push("");
		lines.push(`    ${bold("RESPONSE")}`);
		lines.push(`    ${"─".repeat(40)}`);
		const truncated = trace.response.length > 500
			? `${trace.response.slice(0, 500)}...`
			: trace.response;
		for (const line of truncated.split("\n")) {
			lines.push(`    ${dim(line)}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}

export function renderTraceFromRow(row: TraceRow): string {
	const toolCalls = JSON.parse(row.tool_calls);
	const filesRead = row.files_read ? JSON.parse(row.files_read) : [];

	const trace: TraceResult = {
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
	};

	return renderTrace(trace);
}

export function renderTraceList(rows: TraceRow[]): string {
	const lines: string[] = [];
	lines.push("");
	lines.push(`  ${bold("RECENT TRACES")} ${dim(`(${rows.length})`)}`);
	lines.push("");

	const idWidth = 24;
	const skillWidth = 20;
	const tokensWidth = 8;
	const timeWidth = 8;

	lines.push(
		`  ${dim("ID".padEnd(idWidth))}  ${dim("SKILL".padEnd(skillWidth))}  ${dim("TOKENS".padStart(tokensWidth))}  ${dim("TIME".padStart(timeWidth))}  ${dim("COST")}`,
	);
	lines.push(`  ${"─".repeat(idWidth + skillWidth + tokensWidth + timeWidth + 16)}`);

	for (const row of rows) {
		const id = row.trace_id.padEnd(idWidth);
		const skill = (row.skill_name ?? "(none)").padEnd(skillWidth);
		const tokens = formatTokens(row.tokens_total).padStart(tokensWidth);
		const time = formatDuration(row.duration_ms).padStart(timeWidth);
		const cost = formatCost(row.cost_estimate);

		lines.push(`  ${dim(id)}  ${cyan(skill)}  ${tokens}  ${time}  ${cost}`);
	}

	lines.push("");
	return lines.join("\n");
}

export function renderTraceJson(trace: TraceResult): string {
	return JSON.stringify(
		{
			trace_id: trace.traceId,
			skill_name: trace.skillName,
			prompt: trace.prompt,
			response: trace.response,
			tool_calls: trace.toolCalls.map((tc) => ({
				name: tc.name,
				input: tc.input,
				timestamp_ms: tc.timestampMs,
			})),
			files_read: trace.filesRead,
			tokens: {
				input: trace.tokensIn,
				output: trace.tokensOut,
				total: trace.tokensTotal,
				cache_creation: trace.cacheCreationTokens,
				cache_read: trace.cacheReadTokens,
			},
			duration_ms: trace.durationMs,
			cost_estimate: trace.costEstimate,
			model: trace.model,
			timestamp: trace.timestamp,
		},
		null,
		2,
	);
}
