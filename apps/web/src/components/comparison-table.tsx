"use client";

import { Check, X } from "lucide-react";
import { motion } from "motion/react";

type CellValue = boolean | "partial";

type Row = {
	feature: string;
	skillkit: CellValue;
	manual: CellValue;
	rams: CellValue;
};

const ROWS: Row[] = [
	{ feature: "Install command", skillkit: true, manual: false, rams: true },
	{ feature: "Versioning", skillkit: true, manual: false, rams: false },
	{
		feature: "Multi-agent",
		skillkit: true,
		manual: false,
		rams: "partial" as const,
	},
	{
		feature: "Usage analytics",
		skillkit: true,
		manual: false,
		rams: false,
	},
	{
		feature: "Security scanning",
		skillkit: true,
		manual: false,
		rams: false,
	},
	{ feature: "Auto-updates", skillkit: true, manual: false, rams: false },
	{ feature: "Open source", skillkit: true, manual: true, rams: false },
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
						How SkillKit compares
					</h2>
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
									Manual Copy
								</th>
								<th className="text-center px-6 py-4 text-zinc-500 font-medium">
									rams.ai
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
										<Cell value={row.manual} />
									</td>
									<td className="px-6 py-4 text-center">
										<Cell value={row.rams} />
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
