"use client";

import { Activity, BarChart2, Calendar, Flame, Gauge, Zap } from "lucide-react";
import { motion } from "motion/react";

const cards = [
	{
		id: "burn",
		icon: Flame,
		title: "Burn Rate Analysis",
		description:
			"Track token spend across Claude, Cursor, Codex, and 9 more agents. Daily burn, model breakdown, and plan utilization.",
	},
	{
		id: "sessions",
		icon: BarChart2,
		title: "Session Tracking",
		description:
			"Daily usage across all agents with per-session cost, tokens in/out, and model breakdown. Persisted locally in SQLite.",
	},
	{
		id: "streaks",
		icon: Activity,
		title: "Streaks & Velocity",
		description:
			"Current streak, longest streak, and week-over-week cost velocity. Know your coding momentum at a glance.",
	},
	{
		id: "graph",
		icon: Calendar,
		title: "Contribution Graph",
		description:
			"52-week GitHub-style heatmap of your AI coding activity. Filter by agent to see where you spend your time.",
	},
	{
		id: "context",
		icon: Gauge,
		title: "Context Budget",
		description:
			"Track the token cost of each installed skill. Know exactly how much of your context window skills consume.",
	},
	{
		id: "auto",
		icon: Zap,
		title: "Auto-Scan Hooks",
		description:
			"Install a Claude Code SessionEnd hook to auto-index sessions. Zero-effort analytics that just work.",
	},
];

export function FeatureBento() {
	return (
		<section className="py-24 px-6 bg-[#0e0e0e]">
			<div className="max-w-6xl mx-auto">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="text-center mb-16"
				>
					<h2 className="text-4xl md:text-5xl font-serif italic text-white">
						The observability layer for AI skills
					</h2>
				</motion.div>
				<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
					{cards.map((card, i) => {
						const Icon = card.icon;
						return (
							<motion.div
								key={card.id}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ duration: 0.5, delay: i * 0.08 }}
								className="rounded-xl border border-[#222] bg-[#0a0a0a] p-8 flex flex-col gap-4 group hover:border-[#333] transition-colors"
							>
								<div className="w-10 h-10 rounded-lg bg-white/5 border border-[#333] flex items-center justify-center">
									<Icon className="w-5 h-5 text-white" />
								</div>
								<div>
									<h3 className="text-base font-semibold text-white mb-2">
										{card.title}
									</h3>
									<p className="text-sm text-[#888] leading-relaxed">
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
