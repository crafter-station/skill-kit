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
		<section className="py-16 px-6 border-y border-[#1a1a1a]">
			<div className="max-w-6xl mx-auto flex flex-col items-center gap-8">
				<p className="text-xs text-[#555] uppercase tracking-widest font-medium">
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
							className="px-4 py-2 rounded-full border border-[#222] font-mono text-sm text-[#555] hover:text-white hover:border-[#444] transition-colors cursor-default"
						>
							{agent}
						</span>
					))}
				</motion.div>
			</div>
		</section>
	);
}
