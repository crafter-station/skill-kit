"use client";

import { Github } from "lucide-react";
import { motion } from "motion/react";

export function OpenSourceBlock() {
	return (
		<section className="py-24 px-6 bg-zinc-900/30">
			<div className="max-w-3xl mx-auto text-center">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="flex flex-col items-center gap-6"
				>
					<div className="flex items-center gap-2">
						<span className="px-3 py-1 rounded-full border border-zinc-700 bg-zinc-800/60 text-xs font-mono text-zinc-400">
							MIT License
						</span>
					</div>
					<h2 className="text-3xl font-bold text-white">Built in the open</h2>
					<p className="text-zinc-400 leading-relaxed">
						SkillKit is open source and free forever for individual developers.
						Contribute, fork, or audit the code — it's all there.
					</p>
					<a
						href="https://github.com/crafter-station/skill-kit"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-zinc-700 text-zinc-300 text-sm font-medium hover:border-zinc-500 hover:text-white transition-colors"
					>
						<Github className="w-4 h-4" />
						View on GitHub
					</a>
				</motion.div>
			</div>
		</section>
	);
}
