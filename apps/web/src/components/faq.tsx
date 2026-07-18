"use client";

import { motion } from "motion/react";

const ITEMS = [
	{
		question: "How is this different from skills.sh?",
		answer:
			"skills.sh handles skill distribution — install, update, search. SkillKit is the analytics layer on top: usage tracking, burn rate analysis, streaks, contribution graphs, and context budget optimization.",
	},
	{
		question: "How is this different from Straude?",
		answer:
			"Straude tracks Claude Code usage and uploads it to a cloud leaderboard. SkillKit is local-first (your data never leaves your machine), tracks sessions from 5 agents instead of just Claude, and focuses on efficiency rather than rewarding spend.",
	},
	{
		question: "Which AI coding agents are supported?",
		answer:
			"Session analytics (burn, sessions, graph): Claude Code, Cursor, Codex, Gemini CLI, and OpenCode, with filters like --claude, --cursor, --codex. Skill discovery (scan, list, health): those plus Windsurf, Amp, Continue, Goose, Kiro, Roo Code, and Antigravity. More session connectors are tracked as open issues on GitHub.",
	},
	{
		question: "Is SkillKit free?",
		answer:
			"Yes. SkillKit is MIT-licensed and free forever. All analytics are local-first — your data never leaves your machine.",
	},
	{
		question: "What data does SkillKit collect?",
		answer:
			"None. All analytics are stored locally in SQLite at ~/.skillkit/analytics.db. SkillKit scans your local session files and never phones home.",
	},
	{
		question: "How do I auto-track sessions?",
		answer:
			"Run `skillkit auto --on` to install a Claude Code SessionEnd hook. It runs `skillkit scan` after every session — zero-effort analytics.",
	},
	{
		question: "Does it work with Obsidian?",
		answer:
			"Yes — AgentFiles is an Obsidian plugin that manages AI skills directly from your vault. Install it to browse, enable, and organize skills without leaving Obsidian.",
	},
];

export function FAQ() {
	return (
		<section className="py-24 px-6">
			<div className="max-w-3xl mx-auto">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="text-center mb-12"
				>
					<h2 className="text-4xl md:text-5xl font-serif italic text-white">
						Frequently asked questions
					</h2>
				</motion.div>
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5, delay: 0.1 }}
					className="flex flex-col gap-3"
				>
					{ITEMS.map((item) => (
						<details
							key={item.question}
							className="group rounded-xl border border-[#222] bg-[#0a0a0a] overflow-hidden"
						>
							<summary className="flex items-center justify-between gap-4 px-6 py-5 text-sm font-medium text-[#ccc] cursor-pointer select-none list-none hover:text-white transition-colors">
								{item.question}
								<span
									className="text-[#444] group-open:text-white transition-colors shrink-0 text-base leading-none"
									aria-hidden="true"
								>
									<span className="group-open:hidden">+</span>
									<span className="hidden group-open:inline">&minus;</span>
								</span>
							</summary>
							<p className="px-6 pb-5 text-sm text-[#888] leading-relaxed border-t border-[#222] pt-4">
								{item.answer}
							</p>
						</details>
					))}
				</motion.div>
			</div>
		</section>
	);
}
