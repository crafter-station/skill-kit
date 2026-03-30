"use client";

import { motion } from "motion/react";
import { ObsidianLogo } from "./logos/agent-logos";

export function ObsidianCTA() {
	return (
		<section className="py-20 px-6">
			<div className="max-w-3xl mx-auto">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="rounded-xl border border-[#222] bg-[#0a0a0a] p-10 flex flex-col md:flex-row items-center gap-8"
				>
					<div className="w-16 h-16 rounded-2xl bg-[#7C3AED]/10 border border-[#7C3AED]/20 flex items-center justify-center shrink-0">
						<ObsidianLogo className="w-8 h-8 text-[#7C3AED]" />
					</div>
					<div className="flex-1 text-center md:text-left">
						<h3 className="text-xl font-semibold text-white mb-2">
							Manage skills from Obsidian
						</h3>
						<p className="text-sm text-[#888] leading-relaxed mb-4">
							AgentFiles is an Obsidian plugin that lets you browse, enable, and organize AI skills directly from your vault.
						</p>
						<a
							href="https://github.com/Railly/agentfiles"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#7C3AED] text-white text-sm font-medium hover:bg-[#6D28D9] transition-colors"
						>
							<ObsidianLogo className="w-4 h-4" />
							Get AgentFiles
						</a>
					</div>
				</motion.div>
			</div>
		</section>
	);
}
