"use client";

import { motion } from "motion/react";

const ITEMS = [
	{
		question: "How is this different from manually copying SKILL.md files?",
		answer:
			"SkillKit adds versioning, discovery, and analytics on top of the SKILL.md standard. Instead of hunting down files and copying them between projects, you get a single command that handles installation, updates, and health checks automatically.",
	},
	{
		question: "Which AI coding agents are supported?",
		answer:
			"Claude Code, Cursor, Codex, VS Code (via extensions), Windsurf, and Gemini CLI are all supported today. SkillKit is built on the open SKILL.md standard, so any agent that adopts it works automatically.",
	},
	{
		question: "Is SkillKit free?",
		answer:
			"Yes. SkillKit is MIT-licensed and free forever for individual developers. We may introduce paid plans for teams with advanced features like private registries and audit logs.",
	},
	{
		question: "How do I publish my own skill?",
		answer:
			"Run `skill-kit publish` from any directory with a SKILL.md file. The CLI guides you through signing up as a verified publisher and submitting your skill for review.",
	},
	{
		question: "Do you collect telemetry?",
		answer:
			"We collect anonymous usage counts (install/uninstall events) to power the registry's popularity signals. You can opt out at any time with `skill-kit config set telemetry false`.",
	},
	{
		question: "Can I use SkillKit in my team?",
		answer:
			"Absolutely. SkillKit supports a skills.json lockfile you can commit to your repo, so every team member installs the same verified versions. Team-private registries are on the roadmap.",
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
					<h2 className="text-3xl font-bold text-white">
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
							className="group rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden"
						>
							<summary className="flex items-center justify-between gap-4 px-6 py-5 text-sm font-medium text-zinc-200 cursor-pointer select-none list-none hover:text-white transition-colors">
								{item.question}
								<span className="text-zinc-600 group-open:text-emerald-400 transition-colors shrink-0 text-base leading-none">
									+
								</span>
							</summary>
							<p className="px-6 pb-5 text-sm text-zinc-400 leading-relaxed border-t border-zinc-800 pt-4">
								{item.answer}
							</p>
						</details>
					))}
				</motion.div>
			</div>
		</section>
	);
}
