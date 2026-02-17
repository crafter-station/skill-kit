"use client";

import { Check, X } from "lucide-react";
import { motion } from "motion/react";

const WITHOUT = [
	"Manually copy SKILL.md between projects",
	"No versioning — skills break silently",
	"No discovery — finding good skills is guesswork",
	"No analytics — which skills are you actually using?",
	"Security blindspot — 341 malicious skills found on registries",
];

const WITH = [
	"One command to install from a curated registry",
	"Semantic versioning with safe updates",
	"Searchable directory with quality scores",
	"Usage analytics with sparklines and health checks",
	"Publisher verification and security scanning",
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
						Skills today are broken
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
