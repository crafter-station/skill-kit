"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

type Command = {
	name: string;
	cmd: string;
	description: string;
	lines: Array<{
		text: string;
		type: "dim" | "white" | "accent" | "header" | "empty";
	}>;
};

const COMMANDS: Command[] = [
	{
		name: "burn",
		cmd: "skillkit burn --days 7",
		description: "Token spend, model breakdown, plan utilization",
		lines: [
			{ text: "  BURN RATE — last 7 days", type: "header" },
			{ text: "", type: "empty" },
			{ text: "  CLAUDE", type: "accent" },
			{ text: "    Sessions:  469", type: "white" },
			{ text: "    API calls: 27,331", type: "white" },
			{ text: "", type: "empty" },
			{ text: "    COST", type: "header" },
			{ text: "    Total:        $7,859.58", type: "accent" },
			{ text: "    Daily avg:    $436.64", type: "white" },
			{ text: "    Projected/mo: $13,535.95", type: "white" },
			{ text: "    Plan:         $200/mo", type: "dim" },
			{ text: "    Utilization:  3930%", type: "accent" },
			{ text: "", type: "empty" },
			{ text: "    BY MODEL", type: "header" },
			{ text: "    claude-opus-4-6    ███████████████ $7,711", type: "white" },
			{ text: "    claude-sonnet-4-6  █░░░░░░░░░░░░░░ $103", type: "dim" },
			{ text: "    claude-haiku-4-5   ██░░░░░░░░░░░░░ $44", type: "dim" },
		],
	},
	{
		name: "sessions",
		cmd: "skillkit sessions --days 7",
		description: "Daily usage across all agents",
		lines: [
			{ text: "  SESSIONS (last 7 days)", type: "header" },
			{ text: "", type: "empty" },
			{ text: "  Total: $6,695  541K / 4.7M tokens (in/out)", type: "accent" },
			{ text: "", type: "empty" },
			{ text: "  2026-03-30 Mon   $535.97   claude", type: "white" },
			{ text: "  2026-03-29 Sun   $463.45   claude", type: "white" },
			{ text: "  2026-03-28 Sat   $976.39   claude", type: "accent" },
			{ text: "  2026-03-27 Fri  $1,311.49  claude", type: "accent" },
			{ text: "  2026-03-26 Thu   $854.95   claude", type: "white" },
			{ text: "  2026-03-25 Wed  $1,242.41  claude + cursor", type: "accent" },
			{ text: "  2026-03-24 Tue   $292.15   claude", type: "dim" },
		],
	},
	{
		name: "stats",
		cmd: "skillkit stats",
		description: "Skill usage, streaks, and weekly velocity",
		lines: [
			{ text: "  SKILL-KIT ANALYTICS (last 30 days)", type: "header" },
			{ text: "", type: "empty" },
			{ text: "  Total invocations: 1,866", type: "white" },
			{ text: "  Unique skills:     63", type: "white" },
			{ text: "  Most active day:   Monday", type: "white" },
			{ text: "", type: "empty" },
			{ text: "  Current streak:    12 days \u{1F525}", type: "accent" },
			{ text: "  Longest streak:    12 days", type: "white" },
			{ text: "  This week:         $999 vs $6,034 (-83%)", type: "white" },
			{ text: "", type: "empty" },
			{ text: "  TOP SKILLS", type: "header" },
			{
				text: "  ray              ████████████████  364  \u2585\u2583\u2588",
				type: "accent",
			},
			{
				text: "  trigger-video    ███████████       275  \u2581\u2585\u2583\u2588",
				type: "white",
			},
			{
				text: "  recall           ██████            184  \u2581\u2581\u2585\u2583\u2588",
				type: "dim",
			},
		],
	},
	{
		name: "context",
		cmd: "skillkit context --mcp",
		description: "Context tax: tokens + cost loaded on every API call",
		lines: [
			{
				text: "  CONTEXT TAX — opus pricing, 40 turns/session",
				type: "header",
			},
			{ text: "", type: "empty" },
			{ text: "  ALWAYS LOADED (every API call)", type: "header" },
			{
				text: "  CLAUDE.md + refs        12.5K tokens   $0.0187",
				type: "white",
			},
			{
				text: "  Skills metadata          2.3K tokens   $0.0034",
				type: "white",
			},
			{
				text: "  Memory (MEMORY.md)       4.1K tokens   $0.0061",
				type: "white",
			},
			{
				text: "  MCP tool schemas        46.0K tokens   $0.0690",
				type: "white",
			},
			{ text: "  ────────────────────────────────────────────", type: "dim" },
			{
				text: "  Total                   64.8K tokens   $0.0972/call",
				type: "accent",
			},
			{ text: "", type: "empty" },
			{ text: "  MCP SERVERS (8/15 measured)", type: "header" },
			{ text: "  firecrawl (26)   ███████████████  18.9K", type: "white" },
			{ text: "  trigger (37)     ██████████░░░░░  12.8K", type: "white" },
			{ text: "  google-calendar  ███████░░░░░░░░   9.4K", type: "white" },
			{ text: "", type: "empty" },
			{ text: "  SESSION ESTIMATE (40 turns)", type: "header" },
			{ text: "  With prompt caching     $5.01", type: "accent" },
			{ text: "  Without caching         $38.88", type: "white" },
			{ text: "  Cache savings           87%", type: "dim" },
		],
	},
	{
		name: "drift",
		cmd: "skillkit context --compare pre-pack",
		description: "Diff context against a saved baseline to catch growth",
		lines: [
			{ text: '  CONTEXT DRIFT (vs "pre-pack", 6d ago)', type: "header" },
			{ text: "", type: "empty" },
			{ text: "  Total      18.8K → 64.8K   +46.0K (+244%)", type: "accent" },
			{ text: "", type: "empty" },
			{ text: "  + firecrawl              new   +18.9K", type: "white" },
			{ text: "  + trigger                new   +12.8K", type: "white" },
			{ text: "  + google-calendar        new    +9.4K", type: "white" },
			{ text: "  ~ ./CLAUDE.md      6.5K → 6.7K    +191", type: "white" },
			{ text: "  - removed-skill         gone     -412", type: "dim" },
		],
	},
	{
		name: "health",
		cmd: "skillkit health",
		description: "Unused skills, context budget, DB health",
		lines: [
			{ text: "  SKILLKIT HEALTH REPORT", type: "header" },
			{ text: "", type: "empty" },
			{ text: "  ✓ 43 skills installed", type: "accent" },
			{ text: "  ✓ Analytics DB: 11,848 events tracked", type: "accent" },
			{ text: "", type: "empty" },
			{ text: "  ⚠ 6 skills never used in 30d", type: "white" },
			{ text: "    Run: skillkit prune", type: "dim" },
			{ text: "", type: "empty" },
			{
				text: "  [███░░░░░░░] 34% metadata budget (5.4K / 16.0K)",
				type: "white",
			},
			{
				text: "    name + description of each skill, loaded at startup",
				type: "dim",
			},
			{
				text: "  ● Total skill content: 103.8K chars (loaded on-demand)",
				type: "white",
			},
			{ text: "", type: "empty" },
			{ text: "  ⚠ 1 skill exceeds 500-line recommendation", type: "white" },
			{ text: "    Split SKILL.md into referenced files", type: "dim" },
		],
	},
	{
		name: "graph",
		cmd: "skillkit graph",
		description: "52-week contribution heatmap",
		lines: [
			{ text: "  CONTRIBUTION GRAPH (all agents)", type: "header" },
			{ text: "", type: "empty" },
			{ text: "       Oct   Nov    Dec   Jan   Feb   Mar", type: "dim" },
			{
				text: "                                    \u2593\u2593",
				type: "white",
			},
			{
				text: "  Mon                             \u2591 \u2588\u2593",
				type: "accent",
			},
			{
				text: "                                  \u2592\u2591\u2592",
				type: "white",
			},
			{ text: "  Wed                               \u2588", type: "accent" },
			{
				text: "                                  \u2591\u2591\u2593",
				type: "white",
			},
			{
				text: "  Fri                             \u2591\u2592\u2588",
				type: "accent",
			},
			{
				text: "                                  \u2592\u2592\u2588",
				type: "white",
			},
			{ text: "", type: "empty" },
			{ text: "  Active days: 18  Total: $7,859", type: "white" },
			{
				text: "  \u2591 <$54  \u2592 $292  \u2593 $855  \u2588 >$855",
				type: "dim",
			},
		],
	},
	{
		name: "auto",
		cmd: "skillkit auto --on",
		description: "Auto-index after every Claude Code session",
		lines: [
			{ text: "  AUTO-SCAN", type: "header" },
			{ text: "", type: "empty" },
			{ text: "  \u2713 SessionEnd hook installed", type: "accent" },
			{ text: "", type: "empty" },
			{ text: "  Claude Code hook: active", type: "accent" },
			{ text: "  Command:          skillkit scan --quiet", type: "dim" },
			{ text: "  Trigger:          SessionEnd (async)", type: "dim" },
			{ text: "", type: "empty" },
			{ text: "  Every time you close a Claude Code session,", type: "white" },
			{ text: "  skillkit indexes your usage automatically.", type: "white" },
			{ text: "  No cron. No daemon. Just a hook.", type: "dim" },
		],
	},
];

function TerminalLine({ line }: { line: Command["lines"][0] }) {
	if (line.type === "empty") return <div className="h-3" />;
	const color = {
		dim: "text-[#555]",
		white: "text-[#ccc]",
		accent: "text-white",
		header: "text-[#888] font-medium",
	}[line.type];
	return <div className={cn("leading-6", color)}>{line.text}</div>;
}

export function CommandsShowcase() {
	const [active, setActive] = useState(0);
	const cmd = COMMANDS[active]!;

	return (
		<section className="py-24 px-6">
			<div className="max-w-5xl mx-auto">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="text-center mb-16"
				>
					<h2 className="text-4xl md:text-5xl font-serif italic text-white">
						One CLI. Full picture.
					</h2>
					<p className="text-[#888] mt-3 text-sm">
						Everything runs locally. No accounts, no telemetry, no cloud.
					</p>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5, delay: 0.1 }}
				>
					<div className="flex flex-wrap items-center justify-center gap-2 mb-6">
						{COMMANDS.map((c, i) => (
							<button
								key={c.name}
								type="button"
								onClick={() => setActive(i)}
								className={cn(
									"px-4 py-2 rounded-lg text-sm font-mono transition-all",
									i === active
										? "bg-white text-black font-medium"
										: "bg-white/5 text-[#888] border border-[#222] hover:border-[#444] hover:text-white",
								)}
							>
								{c.name}
							</button>
						))}
					</div>

					<p className="text-center text-sm text-[#666] mb-4">
						{cmd.description}
					</p>

					<div className="rounded-xl border border-[#222] overflow-hidden">
						<div
							className="flex items-center gap-2 px-4 py-3 border-b border-[#222]"
							style={{ background: "#0a0a0a" }}
						>
							<span className="w-3 h-3 rounded-full bg-[#333]" />
							<span className="w-3 h-3 rounded-full bg-[#333]" />
							<span className="w-3 h-3 rounded-full bg-[#333]" />
							<span className="flex-1 text-center text-xs text-[#555] font-mono -ml-16">
								terminal
							</span>
						</div>
						<div
							className="p-5 font-mono text-sm min-h-[360px]"
							style={{ background: "#0a0a0a" }}
						>
							<div className="flex items-start gap-2 leading-6 mb-3">
								<span className="text-[#555] select-none">$</span>
								<span className="text-white">{cmd.cmd}</span>
							</div>
							<div className="border-t border-[#1a1a1a] pt-3">
								{cmd.lines.map((line, i) => (
									<TerminalLine key={`${cmd.name}-${i}`} line={line} />
								))}
							</div>
						</div>
						<div
							className="flex items-center justify-between px-4 py-1.5 border-t border-[#222] text-[10px] font-mono text-[#444]"
							style={{ background: "#0e0e0e" }}
						>
							<span>skillkit v0.10</span>
							<span>local-first</span>
							<span>13 commands</span>
						</div>
					</div>
				</motion.div>
			</div>
		</section>
	);
}
