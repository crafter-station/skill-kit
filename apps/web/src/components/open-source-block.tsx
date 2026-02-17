"use client";

import { Github } from "lucide-react";
import { motion } from "motion/react";

export function OpenSourceBlock() {
	return (
		<section className="py-24 px-6 bg-[#0e0e0e]">
			<div className="max-w-3xl mx-auto text-center">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="flex flex-col items-center gap-6"
				>
					<div className="flex items-center gap-2">
						<span className="px-3 py-1 rounded-full border border-[#333] bg-white/5 text-xs font-mono text-[#888]">
							MIT License
						</span>
					</div>
					<h2 className="text-4xl md:text-5xl font-serif italic text-white">
						Built in the open
					</h2>
					<p className="text-[#888] leading-relaxed">
						SkillKit is free and open source. All analytics run locally on your
						machine. Contribute, fork, or audit the code.
					</p>
					<a
						href="https://github.com/crafter-station/skill-kit"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-[#333] text-[#ccc] text-sm font-medium hover:border-[#555] hover:text-white transition-colors"
					>
						<Github className="w-4 h-4" aria-hidden="true" />
						View on GitHub
					</a>
				</motion.div>
			</div>
		</section>
	);
}
