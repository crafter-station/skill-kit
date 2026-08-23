import { bold, cyan, dim, green, red, yellow } from "../tui/colors";
import type { AuditResult, AuditStatus } from "./analyzer";

function statusLabel(status: AuditStatus): string {
	if (status === "pass") return green("PASS");
	if (status === "warn") return yellow("WARN");
	return red("FAIL");
}

function formatTokens(tokens: number): string {
	if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
	return String(tokens);
}

export function renderAuditReport(result: AuditResult): string {
	const lines: string[] = [];
	lines.push("");
	lines.push(
		`  ${bold("SKILL AUDIT")} ${dim(`(${result.summary.total} skills)`)}`,
	);
	lines.push("");
	lines.push(
		`  ${dim("STATUS")}  ${dim("SKILL".padEnd(28))} ${dim("LINES".padStart(6))} ${dim("TOKENS".padStart(7))} ${dim("REF".padStart(4))} ${dim("SCRIPT".padStart(6))} ${dim("ASSET".padStart(5))} ${dim("ISSUES".padStart(6))}`,
	);
	lines.push(`  ${"─".repeat(78)}`);
	for (const skill of result.skills) {
		const status =
			skill.status === "pass"
				? green("PASS  ")
				: skill.status === "warn"
					? yellow("WARN  ")
					: red("FAIL  ");
		lines.push(
			`  ${status}  ${skill.name.slice(0, 28).padEnd(28)} ${String(skill.metrics.lines).padStart(6)} ${formatTokens(skill.metrics.estimatedTokens).padStart(7)} ${String(skill.metrics.referenceFiles).padStart(4)} ${String(skill.metrics.scriptFiles).padStart(6)} ${String(skill.metrics.assetFiles).padStart(5)} ${String(skill.findings.length).padStart(6)}`,
		);
	}

	lines.push("");
	lines.push(`  ${bold("CONTEXT PROFILE")}`);
	lines.push(
		`  Catalog cost       ${bold(`~${formatTokens(result.summary.catalogTokens)} tokens`)} ${dim("name + description, eager")}`,
	);
	lines.push(
		`  Activation cost    ${bold(`~${formatTokens(result.summary.activationTokens.median)} median`)} ${dim(`/ ~${formatTokens(result.summary.activationTokens.max)} max, one SKILL.md`)}`,
	);
	lines.push(
		`  On-demand cost     ${bold(`~${formatTokens(result.summary.onDemandReferenceTokens)} tokens`)} ${dim(`across ${result.summary.referenceFiles} reference files`)}`,
	);
	lines.push(
		`  Bundled files      ${result.summary.scriptFiles} scripts ${dim("/")} ${result.summary.assetFiles} assets`,
	);

	const skillFindings = result.skills.flatMap((skill) =>
		skill.findings.map((finding) => ({ skill: skill.name, finding })),
	);
	if (skillFindings.length > 0) {
		lines.push("");
		lines.push(`  ${bold("FINDINGS")}`);
		for (const { skill, finding } of skillFindings) {
			const icon = finding.severity === "error" ? red("!") : yellow("!");
			lines.push(`  ${icon} ${cyan(skill)}: ${finding.message}`);
		}
	}

	if (result.overlaps.length > 0) {
		lines.push("");
		lines.push(`  ${bold("POSSIBLE OVERLAPS")}`);
		for (const overlap of result.overlaps) {
			const icon = overlap.severity === "error" ? red("!") : yellow("!");
			const reason =
				overlap.reason === "duplicate_name"
					? "duplicate name"
					: `${Math.round(overlap.similarity * 100)}% description similarity`;
			lines.push(
				`  ${icon} ${overlap.skills.join(" × ")} ${dim(`(${reason})`)}`,
			);
		}
	}

	lines.push("");
	lines.push(
		`  ${statusLabel(result.summary.status)} ${result.summary.passed} passed, ${result.summary.warned} warned, ${result.summary.failed} failed, ${result.summary.findings} findings`,
	);
	lines.push(`  ${dim("Token counts are local estimates: characters / 3.7")}`);
	lines.push("");
	return lines.join("\n");
}

export function renderAuditJson(result: AuditResult): string {
	return JSON.stringify(
		{
			roots: result.roots,
			include: result.include,
			token_estimation: result.tokenEstimation,
			summary: {
				total: result.summary.total,
				passed: result.summary.passed,
				warned: result.summary.warned,
				failed: result.summary.failed,
				status: result.summary.status,
				catalog_tokens: result.summary.catalogTokens,
				activation_tokens: {
					total: result.summary.activationTokens.total,
					median: result.summary.activationTokens.median,
					max: result.summary.activationTokens.max,
				},
				on_demand_reference_tokens: result.summary.onDemandReferenceTokens,
				reference_files: result.summary.referenceFiles,
				script_files: result.summary.scriptFiles,
				asset_files: result.summary.assetFiles,
				findings: result.summary.findings,
			},
			overlaps: result.overlaps,
			skills: result.skills.map((skill) => ({
				name: skill.name,
				description: skill.description,
				path: skill.path,
				skill_file: skill.skillFile,
				status: skill.status,
				metrics: {
					lines: skill.metrics.lines,
					chars: skill.metrics.chars,
					estimated_tokens: skill.metrics.estimatedTokens,
					metadata_tokens: skill.metrics.metadataTokens,
					reference_tokens: skill.metrics.referenceTokens,
					reference_files: skill.metrics.referenceFiles,
					script_files: skill.metrics.scriptFiles,
					asset_files: skill.metrics.assetFiles,
				},
				files: skill.files.map((file) => ({
					path: file.path,
					kind: file.kind,
					bytes: file.bytes,
					lines: file.lines,
					estimated_tokens: file.estimatedTokens,
					referenced: file.referenced,
					explicit_instruction: file.explicitInstruction,
				})),
				findings: skill.findings,
			})),
		},
		null,
		2,
	);
}
