"use client";

import { motion } from "motion/react";

const SUPPORTED = ["Claude Code", "OpenCode"];

const PLANNED = [
	"Cursor",
	"Codex",
	"Windsurf",
	"Gemini CLI",
	"Cline",
	"Roo Code",
	"GitHub Copilot",
	"OpenHands",
	"Goose",
	"Kilo Code",
	"Trae",
];

export function AgentLogoBelt() {
	return (
		<section className="py-16 px-6 border-y border-[#1a1a1a]">
			<div className="max-w-6xl mx-auto flex flex-col items-center gap-8">
				<p className="text-xs text-[#555] uppercase tracking-widest font-medium">
					Works with your agent
				</p>
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="flex flex-wrap items-center justify-center gap-3"
				>
					{SUPPORTED.map((agent) => (
						<span
							key={agent}
							className="px-4 py-2 rounded-full border border-[#333] font-mono text-sm text-white"
						>
							{agent}
						</span>
					))}
					{PLANNED.map((agent) => (
						<span
							key={agent}
							className="px-4 py-2 rounded-full border border-[#1a1a1a] font-mono text-sm text-[#333]"
						>
							{agent}
						</span>
					))}
					<span className="px-4 py-2 font-mono text-xs text-[#444]">
						+30 more planned
					</span>
				</motion.div>
			</div>
		</section>
	);
}
