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
		skillkit: true,
		skillssh: true,
		manual: false,
	},
	{ feature: "Registry search", skillkit: true, skillssh: true, manual: false },
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
		feature: "Session JSONL scanning",
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
				<span className="text-xs text-zinc-500 font-mono">~</span>
			</span>
		);
	}
	if (value) {
		return <Check className="w-4 h-4 text-emerald-400 mx-auto" />;
	}
	return <X className="w-4 h-4 text-zinc-600 mx-auto" />;
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
					<h2 className="text-3xl font-bold text-white">
						SkillKit + skills.sh = complete stack
					</h2>
					<p className="text-zinc-400 mt-3 text-sm">
						skills.sh handles distribution. SkillKit handles observability.
					</p>
				</motion.div>
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5, delay: 0.1 }}
					className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden"
				>
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-zinc-800">
								<th className="text-left px-6 py-4 text-zinc-500 font-medium">
									Feature
								</th>
								<th className="text-center px-6 py-4 text-emerald-400 font-semibold">
									SkillKit
								</th>
								<th className="text-center px-6 py-4 text-zinc-500 font-medium">
									skills.sh
								</th>
								<th className="text-center px-6 py-4 text-zinc-500 font-medium">
									Manual Copy
								</th>
							</tr>
						</thead>
						<tbody>
							{ROWS.map((row, i) => (
								<tr
									key={row.feature}
									className={
										i < ROWS.length - 1 ? "border-b border-zinc-800/60" : ""
									}
								>
									<td className="px-6 py-4 text-zinc-300">{row.feature}</td>
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
