"use client";

import { Check, X } from "lucide-react";
import { motion } from "motion/react";

type CellValue = boolean | "partial";

type Row = {
	feature: string;
	skillkit: CellValue;
	skillssh: CellValue;
	manual: CellValue;
};

const ROWS: Row[] = [
	{
		feature: "Install / update skills",
		skillkit: false,
		skillssh: true,
		manual: false,
	},
	{
		feature: "Registry search",
		skillkit: false,
		skillssh: true,
		manual: false,
	},
	{
		feature: "Usage analytics",
		skillkit: true,
		skillssh: false,
		manual: false,
	},
	{
		feature: "Context budget tracking",
		skillkit: true,
		skillssh: false,
		manual: false,
	},
	{ feature: "Health checks", skillkit: true, skillssh: false, manual: false },
	{
		feature: "Unused skill pruning",
		skillkit: true,
		skillssh: false,
		manual: false,
	},
	{
		feature: "Session analytics (Claude Code + OpenCode)",
		skillkit: true,
		skillssh: false,
		manual: false,
	},
	{
		feature: "Local-first (no telemetry)",
		skillkit: true,
		skillssh: false,
		manual: true,
	},
];

function Cell({ value }: { value: CellValue }) {
	if (value === "partial") {
		return (
			<span className="inline-flex items-center justify-center w-6 h-6">
				<span className="text-xs text-[#555] font-mono">~</span>
			</span>
		);
	}
	if (value) {
		return <Check className="w-4 h-4 text-white mx-auto" aria-hidden="true" />;
	}
	return <X className="w-4 h-4 text-[#333] mx-auto" aria-hidden="true" />;
}

export function ComparisonTable() {
	return (
		<section className="py-24 px-6">
			<div className="max-w-4xl mx-auto">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="text-center mb-12"
				>
					<h2 className="text-4xl md:text-5xl font-serif italic text-white">
						Distribution + Observability
					</h2>
					<p className="text-[#888] mt-3 text-sm">
						skills.sh installs your skills. SkillKit tells you which ones
						matter.
					</p>
				</motion.div>
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5, delay: 0.1 }}
					className="rounded-xl border border-[#222] bg-[#0a0a0a] overflow-hidden"
				>
					<table className="w-full text-sm">
						<caption className="sr-only">
							Comparison of SkillKit, skills.sh, and manual skill management
						</caption>
						<thead>
							<tr className="border-b border-[#222]">
								<th className="text-left px-6 py-4 text-[#555] font-medium">
									Feature
								</th>
								<th className="text-center px-6 py-4 text-white font-semibold">
									SkillKit
								</th>
								<th className="text-center px-6 py-4 text-[#555] font-medium">
									skills.sh
								</th>
								<th className="text-center px-6 py-4 text-[#555] font-medium">
									Manual Copy
								</th>
							</tr>
						</thead>
						<tbody>
							{ROWS.map((row, i) => (
								<tr
									key={row.feature}
									className={
										i < ROWS.length - 1 ? "border-b border-[#1a1a1a]" : ""
									}
								>
									<td className="px-6 py-4 text-[#ccc]">{row.feature}</td>
									<td className="px-6 py-4 text-center">
										<Cell value={row.skillkit} />
									</td>
									<td className="px-6 py-4 text-center">
										<Cell value={row.skillssh} />
									</td>
									<td className="px-6 py-4 text-center">
										<Cell value={row.manual} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</motion.div>
			</div>
		</section>
	);
}
