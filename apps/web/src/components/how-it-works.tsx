"use client";

import { motion } from "motion/react";

const STEPS = [
	{
		number: "01",
		title: "Install with skills.sh",
		description:
			"Use the standard. SkillKit wraps skills.sh for install, update, and search.",
		snippet: "$ skill-kit install owner/repo",
	},
	{
		number: "02",
		title: "Analyze usage",
		description:
			"Scan your session files to see which skills you actually invoke.",
		snippet: "$ skill-kit stats",
	},
	{
		number: "03",
		title: "Optimize",
		description:
			"Drop unused skills, reclaim context budget, keep what matters.",
		snippet: "$ skill-kit health",
	},
];

export function HowItWorks() {
	return (
		<section className="py-24 px-6">
			<div className="max-w-6xl mx-auto">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="text-center mb-16"
				>
					<h2 className="text-3xl font-bold text-white">How it works</h2>
				</motion.div>
				<div className="grid md:grid-cols-3 gap-6">
					{STEPS.map((step, i) => (
						<motion.div
							key={step.number}
							initial={{ opacity: 0, y: 24 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5, delay: i * 0.1 }}
							className="flex flex-col gap-5"
						>
							<div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
								<span className="text-xs font-mono font-bold text-emerald-400">
									{step.number}
								</span>
							</div>
							<div>
								<h3 className="text-lg font-semibold text-white mb-2">
									{step.title}
								</h3>
								<p className="text-sm text-zinc-400 leading-relaxed">
									{step.description}
								</p>
							</div>
							<div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 font-mono text-sm text-emerald-400">
								{step.snippet}
							</div>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}
