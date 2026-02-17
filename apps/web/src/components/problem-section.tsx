"use client";

import { Check, X } from "lucide-react";
import { motion } from "motion/react";

const WITHOUT = [
	"50 skills installed, no idea which ones you actually use",
	"Context window bloated with unused skills eating tokens",
	"No way to tell if a skill invocation failed or succeeded",
	"Guessing which skills to keep vs drop after each project",
	"Zero visibility into how skills affect agent performance",
];

const WITH = [
	"Usage sparklines show exactly which skills earn their keep",
	"Context budget analysis — see token cost per skill",
	"Health checks flag unused skills wasting your context window",
	"Session scanning extracts real invocation data from JSONL logs",
	"Install and manage via skills.sh, analyze with SkillKit",
];

export function ProblemSection() {
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
					<h2 className="text-3xl font-bold text-white">
						You have no idea which skills matter
					</h2>
				</motion.div>
				<div className="grid md:grid-cols-2 gap-6">
					<motion.div
						initial={{ opacity: 0, x: -20 }}
						whileInView={{ opacity: 1, x: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5, delay: 0.1 }}
						className="rounded-xl border border-zinc-800 bg-zinc-900 p-8"
					>
						<div className="flex items-center gap-2 mb-6">
							<span className="w-2 h-2 rounded-full bg-red-400" />
							<h3 className="text-sm font-medium text-red-400 uppercase tracking-widest">
								Without SkillKit
							</h3>
						</div>
						<ul className="space-y-4">
							{WITHOUT.map((item) => (
								<li key={item} className="flex items-start gap-3">
									<X className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
									<span className="text-sm text-zinc-400 leading-relaxed">
										{item}
									</span>
								</li>
							))}
						</ul>
					</motion.div>
					<motion.div
						initial={{ opacity: 0, x: 20 }}
						whileInView={{ opacity: 1, x: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5, delay: 0.2 }}
						className="rounded-xl border border-emerald-500/20 bg-zinc-900 p-8"
					>
						<div className="flex items-center gap-2 mb-6">
							<span className="w-2 h-2 rounded-full bg-emerald-400" />
							<h3 className="text-sm font-medium text-emerald-400 uppercase tracking-widest">
								With SkillKit
							</h3>
						</div>
						<ul className="space-y-4">
							{WITH.map((item) => (
								<li key={item} className="flex items-start gap-3">
									<Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
									<span className="text-sm text-zinc-400 leading-relaxed">
										{item}
									</span>
								</li>
							))}
						</ul>
					</motion.div>
				</div>
			</div>
		</section>
	);
}
