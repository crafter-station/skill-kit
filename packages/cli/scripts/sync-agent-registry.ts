/**
 * Vendors the agent registry from vercel-labs/skills (skills.sh) into
 * src/scanner/agent-registry.generated.json so skillkit's skill-dir
 * detection never drifts from the ecosystem source of truth.
 *
 * Usage: bun run scripts/sync-agent-registry.ts
 * Re-run whenever skills.sh ships new agents.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = "https://github.com/vercel-labs/skills.git";

interface VendoredAgent {
	id: string;
	displayName: string;
	skillsDir: string;
	globalSkillsDir: string | null;
}

const tmp = mkdtempSync(join(tmpdir(), "skills-sh-"));
try {
	const clone = Bun.spawnSync(
		["git", "clone", "--depth", "1", REPO, join(tmp, "skills")],
		{ stderr: "pipe" },
	);
	if (clone.exitCode !== 0) {
		console.error(clone.stderr.toString());
		process.exit(1);
	}

	const srcPath = join(tmp, "skills", "src", "agents.ts");
	const pkg = JSON.parse(
		await Bun.file(join(tmp, "skills", "package.json")).text(),
	) as { version: string };
	const src = await Bun.file(srcPath).text();

	// Static extraction: the registry is a pure object literal keyed by agent id.
	// We resolve the same home-relative helpers agents.ts uses, as portable tokens.
	const HOME_TOKENS: Array<[RegExp, string]> = [
		[/join\(home,\s*'([^']+)'\)/g, "~/$1"],
		[/join\(home,\s*'([^']+)',\s*'([^']+)'\)/g, "~/$1/$2"],
		[/join\(home,\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g, "~/$1/$2/$3"],
		[
			/join\(home,\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g,
			"~/$1/$2/$3/$4",
		],
		[/join\(configHome,\s*'([^']+)'\)/g, "$XDG_CONFIG/$1"],
		[/join\(codexHome,\s*'([^']+)'\)/g, "$CODEX_HOME/$1"],
		[/join\(claudeHome,\s*'([^']+)'\)/g, "$CLAUDE_HOME/$1"],
		[/join\(vibeHome,\s*'([^']+)'\)/g, "~/.vibe/$1"],
		[/join\(hermesHome,\s*'([^']+)'\)/g, "~/.hermes/$1"],
		[/join\(autohandHome,\s*'([^']+)'\)/g, "~/.autohand/$1"],
		[/join\(grokHome,\s*'([^']+)'\)/g, "~/.grok/$1"],
	];

	function resolveDirExpr(expr: string): string | null {
		const trimmed = expr.trim();
		if (trimmed === "undefined") return null;
		if (/^getOpenClawGlobalSkillsDir\(\)$/.test(trimmed))
			return "~/.openclaw/skills";
		let out = trimmed;
		for (const [re, repl] of HOME_TOKENS) {
			out = out.replace(re, repl);
		}
		if (out.startsWith("'") && out.endsWith("'")) return out.slice(1, -1);
		if (out.startsWith("~") || out.startsWith("$")) return out;
		return null;
	}

	const agentRe =
		/^ {2}'?([\w-]+)'?: \{\n {4}name: '([^']+)',\n {4}displayName: '([^']+)',\n {4}skillsDir: '([^']+)',\n {4}globalSkillsDir: ([^\n]+?),?\n/gm;

	const agents: VendoredAgent[] = [];
	let m: RegExpExecArray | null;
	while ((m = agentRe.exec(src)) !== null) {
		const [, , name, displayName, skillsDir, globalExpr] = m;
		agents.push({
			id: name!,
			displayName: displayName!,
			skillsDir: skillsDir!,
			globalSkillsDir: resolveDirExpr(globalExpr!),
		});
	}

	if (agents.length < 50) {
		console.error(
			`Extraction looks broken: only ${agents.length} agents parsed (expected 70+). agents.ts format may have changed.`,
		);
		process.exit(1);
	}

	const out = {
		source: "vercel-labs/skills",
		sourceVersion: pkg.version,
		syncedAt: new Date().toISOString(),
		agents,
	};

	const outPath = join(
		import.meta.dir,
		"..",
		"src",
		"scanner",
		"agent-registry.generated.json",
	);
	writeFileSync(outPath, `${JSON.stringify(out, null, "\t")}\n`);
	console.log(
		`Vendored ${agents.length} agents from skills.sh v${pkg.version} -> ${outPath}`,
	);
} finally {
	rmSync(tmp, { recursive: true, force: true });
}
