"use client";

import { motion } from "motion/react";

const AGENTS = [
	"Claude Code",
	"Cursor",
	"Codex",
	"VS Code",
	"Windsurf",
	"Gemini CLI",
];

export function AgentLogoBelt() {
	return (
		<section className="py-16 px-6 border-y border-zinc-800/50">
			<div className="max-w-6xl mx-auto flex flex-col items-center gap-8">
				<p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
					Works with the tools you already use
				</p>
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="flex flex-wrap items-center justify-center gap-3"
				>
					{AGENTS.map((agent) => (
						<span
							key={agent}
							className="px-4 py-2 rounded-full border border-zinc-800 font-mono text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors cursor-default"
						>
							{agent}
						</span>
					))}
				</motion.div>
			</div>
		</section>
	);
}
