"use client";

import { BarChart2, Layers, ShieldCheck, Store } from "lucide-react";
import { motion } from "motion/react";

const cards = [
	{
		id: "analytics",
		icon: BarChart2,
		title: "Usage Analytics",
		description:
			"Sparklines, heatmaps, and health scores for every skill. Know exactly which skills drive your productivity.",
		large: true,
	},
	{
		id: "multi-agent",
		icon: Layers,
		title: "Multi-Agent",
		description:
			"Works seamlessly across Claude Code, Cursor, Codex, and more. One registry, every agent.",
		large: false,
	},
	{
		id: "security",
		icon: ShieldCheck,
		title: "Security First",
		description:
			"Publisher verification, dependency scanning, and sandboxed execution. Install with confidence.",
		large: false,
	},
	{
		id: "registry",
		icon: Store,
		title: "Registry",
		description:
			"Browse, search, and install from a curated marketplace of verified skills with quality scores and community ratings.",
		large: true,
	},
];

export function FeatureBento() {
	return (
		<section className="py-24 px-6 bg-zinc-900/30">
			<div className="max-w-6xl mx-auto">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="text-center mb-16"
				>
					<h2 className="text-3xl font-bold text-white">
						Everything you need to manage skills
					</h2>
				</motion.div>
				<div className="grid md:grid-cols-2 gap-4">
					{cards.map((card, i) => {
						const Icon = card.icon;
						return (
							<motion.div
								key={card.id}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ duration: 0.5, delay: i * 0.08 }}
								className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 flex flex-col gap-4 group hover:border-zinc-700 transition-colors"
							>
								<div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
									<Icon className="w-5 h-5 text-emerald-400" />
								</div>
								<div>
									<h3 className="text-base font-semibold text-white mb-2">
										{card.title}
									</h3>
									<p className="text-sm text-zinc-400 leading-relaxed">
										{card.description}
									</p>
								</div>
							</motion.div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
