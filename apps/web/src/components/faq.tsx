"use client";

import { motion } from "motion/react";

const ITEMS = [
	{
		question: "How is this different from skills.sh?",
		answer:
			"skills.sh handles skill distribution — install, update, search. SkillKit is the analytics layer on top: local-first usage tracking, health checks, context budget analysis, and pruning that skills.sh doesn't provide.",
	},
	{
		question: "Which AI coding agents are supported?",
		answer:
			"Claude Code, Cursor, Codex, VS Code (via extensions), Windsurf, and Gemini CLI. SkillKit scans session JSONL files to extract skill invocations, so any agent that logs tool use is supported.",
	},
	{
		question: "Is SkillKit free?",
		answer:
			"Yes. SkillKit is MIT-licensed and free forever. All analytics are local-first — your data never leaves your machine.",
	},
	{
		question: "What data does SkillKit collect?",
		answer:
			"None. All analytics are stored locally in a SQLite database at ~/.skillkit/analytics.db. SkillKit scans your local session files and never phones home.",
	},
	{
		question: "How does the session scanning work?",
		answer:
			"Run `skillkit scan` to discover installed skills and scan ~/.claude/projects/ for JSONL session files. It extracts Skill tool_use blocks and populates a local analytics database with invocation counts, timestamps, and patterns.",
	},
	{
		question: "Can I use SkillKit without skills.sh?",
		answer:
			"Yes. SkillKit is purely an analytics tool — scan, list, stats, and health all work independently. Use skills.sh (npx skills add) to install and manage skills, then use SkillKit to measure and optimize.",
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
								<span className="text-[#444] group-open:text-white transition-colors shrink-0 text-base leading-none">
									+
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
