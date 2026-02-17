"use client";

import { motion } from "motion/react";

const BEFORE = [
	{ line: 1, text: "/**" },
	{ line: 2, text: " * 50 skills installed,", highlight: true },
	{ line: 3, text: " * no idea which ones you use.", highlight: true },
	{ line: 4, text: " */" },
	{ line: 5, text: "export const Skills = () => {" },
	{ line: 6, text: "  <Skill.Provider>" },
	{ line: 7, text: "    <Bloated />", highlight: true },
	{ line: 8, text: "    <Invisible />", highlight: true },
	{ line: 9, text: "    <Guessing />", highlight: true },
	{ line: 10, text: "  </Skill.Provider>" },
	{ line: 11, text: "};" },
];

const AFTER = [
	{ line: 1, text: "/**" },
	{ line: 2, text: " * Every skill earns its keep,", highlight: true },
	{ line: 3, text: " * measured and optimized.", highlight: true },
	{ line: 4, text: " */" },
	{ line: 5, text: "export const Skills = () => {" },
	{ line: 6, text: "  <Skill.Provider>" },
	{ line: 7, text: "    <Tracked />", highlight: true },
	{ line: 8, text: "    <Measured />", highlight: true },
	{ line: 9, text: "    <Optimized />", highlight: true },
	{ line: 10, text: "  </Skill.Provider>" },
	{ line: 11, text: "};" },
];

function CodeBlock({
	lines,
	variant,
}: {
	lines: typeof BEFORE;
	variant: "before" | "after";
}) {
	const barColor = variant === "before" ? "bg-[#444]" : "bg-white";
	const highlightColor =
		variant === "before" ? "text-[#666]" : "text-white/90";

	return (
		<div className="rounded-xl border border-[#222] bg-[#0a0a0a] overflow-hidden font-mono text-sm">
			<div className="p-5 space-y-0">
				{lines.map((l) => (
					<div key={l.line} className="flex items-start leading-7">
						<span className="w-8 text-right text-[#444] select-none pr-4 shrink-0">
							{String(l.line).padStart(2, "0")}
						</span>
						{l.highlight && (
							<span
								className={`w-[2px] shrink-0 self-stretch mr-3 ${barColor}`}
							/>
						)}
						{!l.highlight && <span className="w-[2px] shrink-0 mr-3" />}
						<span className={l.highlight ? highlightColor : "text-[#555]"}>
							{l.text}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

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
					<h2 className="text-4xl md:text-5xl font-serif italic text-white">
						Think diff
					</h2>
					<p className="text-[#888] mt-4 max-w-2xl mx-auto leading-relaxed">
						Software development is changing rapidly. As code gets easier to
						generate, the bottleneck shifts to understanding which skills
						actually matter.
					</p>
				</motion.div>
				<div className="grid md:grid-cols-2 gap-6">
					<motion.div
						initial={{ opacity: 0, x: -20 }}
						whileInView={{ opacity: 1, x: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5, delay: 0.1 }}
					>
						<CodeBlock lines={BEFORE} variant="before" />
					</motion.div>
					<motion.div
						initial={{ opacity: 0, x: 20 }}
						whileInView={{ opacity: 1, x: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5, delay: 0.2 }}
					>
						<CodeBlock lines={AFTER} variant="after" />
					</motion.div>
				</div>
			</div>
		</section>
	);
}
