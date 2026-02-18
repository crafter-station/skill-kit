"use client";

import { motion } from "motion/react";

export function HowItWorks() {
	return (
		<section className="py-24 px-6">
			<div className="max-w-3xl mx-auto">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="text-center mb-20"
				>
					<h2 className="text-4xl md:text-5xl font-serif italic text-white">
						How it works
					</h2>
				</motion.div>

				<div className="flex flex-col gap-24">
					{/* 01 — Scan */}
					<motion.div
						initial={{ opacity: 0, y: 24 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5 }}
					>
						<div className="mb-8">
							<span className="text-4xl md:text-5xl font-serif italic text-[#222] leading-none">
								01
							</span>
							<h3 className="text-3xl md:text-4xl font-serif italic text-white mt-1">
								Scan
							</h3>
							<p className="text-sm text-[#555] mt-2">
								Already have skills installed? One command picks them all up.
							</p>
						</div>
						<div className="rounded-lg border border-[#222] bg-[#0a0a0a] p-4 font-mono text-sm">
							<div className="flex items-start gap-2 leading-7">
								<span className="text-[#555] select-none">$</span>
								<span className="text-white">skillkit scan</span>
							</div>
							<div className="mt-3 pt-3 border-t border-[#1a1a1a] space-y-0.5">
								<div className="text-[#555] leading-7">
									Scanning 3 agents: Claude Code, Cursor, OpenCode
								</div>
								<div className="text-white leading-7">
									Found 12 skills (8 via skills.sh, 4 manual)
								</div>
								<div className="text-[#555] leading-7">
									Indexed 211 sessions · 1,847 invocations
								</div>
								<div className="text-white leading-7">
									Ready. Run skillkit stats to see usage.
								</div>
							</div>
						</div>
					</motion.div>

					{/* 02 — Measure */}
					<motion.div
						initial={{ opacity: 0, y: 24 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5 }}
					>
						<div className="mb-8">
							<span className="text-4xl md:text-5xl font-serif italic text-[#222] leading-none">
								02
							</span>
							<h3 className="text-3xl md:text-4xl font-serif italic text-white mt-1">
								Measure
							</h3>
							<p className="text-sm text-[#555] mt-2">
								See which skills you actually use. Real data from your sessions.
							</p>
						</div>
						<div className="rounded-lg border border-[#222] bg-[#0a0a0a] font-mono text-sm overflow-hidden">
							<div className="p-4">
								<div className="flex items-start gap-2 leading-7">
									<span className="text-[#555] select-none">$</span>
									<span className="text-white">skillkit stats --top 5</span>
								</div>
							</div>
							<div className="border-t border-[#1a1a1a]" />
							<div className="p-4">
								<div className="grid grid-cols-[auto_auto_1fr] gap-x-5 gap-y-0.5">
									<span className="text-[#555] leading-7">SKILL</span>
									<span className="text-[#555] leading-7 text-right">30d</span>
									<span className="text-[#555] leading-7">TREND</span>

									<span className="text-white leading-7">commit</span>
									<span className="text-white leading-7 text-right">42</span>
									<span className="text-white leading-7">▂▃▅▇█▆▅▇█</span>

									<span className="text-white leading-7">review</span>
									<span className="text-white leading-7 text-right">38</span>
									<span className="text-white leading-7">▁▃▅▆▇▇▆▅▃</span>

									<span className="text-white leading-7">deploy</span>
									<span className="text-white leading-7 text-right">27</span>
									<span className="text-white leading-7">▁▁▂▃▅▇█▇▅</span>

									<span className="text-[#555] leading-7">lint</span>
									<span className="text-[#555] leading-7 text-right">3</span>
									<span className="text-[#555] leading-7">▁▁▁▁▁▁▁▁▂</span>

									<span className="text-[#444] leading-7">scaffold</span>
									<span className="text-[#444] leading-7 text-right">0</span>
									<span className="text-[#333] leading-7">░░░░░░░░░░</span>
								</div>
							</div>
							<div className="border-t border-[#1a1a1a] px-4 py-2.5">
								<span className="text-[#555] text-xs">
									5 skills · 127 total invocations · 30d window
								</span>
							</div>
						</div>
					</motion.div>

					{/* 03 — Optimize */}
					<motion.div
						initial={{ opacity: 0, y: 24 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5 }}
					>
						<div className="mb-8">
							<span className="text-4xl md:text-5xl font-serif italic text-[#222] leading-none">
								03
							</span>
							<h3 className="text-3xl md:text-4xl font-serif italic text-white mt-1">
								Optimize
							</h3>
							<p className="text-sm text-[#555] mt-2">
								Drop what you don't use. Reclaim context budget.
							</p>
						</div>
						<div className="rounded-lg border border-[#222] bg-[#0a0a0a] font-mono text-sm overflow-hidden">
							<div className="p-4">
								<div className="flex items-start gap-2 leading-7">
									<span className="text-[#555] select-none">$</span>
									<span className="text-white">skillkit health</span>
								</div>
							</div>
							<div className="border-t border-[#1a1a1a]" />
							<div className="p-4 space-y-2">
								<div className="leading-7">
									<span className="text-white">[████████</span>
									<span className="text-[#333]">░░</span>
									<span className="text-white">] 78%</span>
									<span className="text-[#555]">
										{" "}
										metadata budget (12.5K / 16.0K)
									</span>
								</div>
								<div className="border-t border-[#1a1a1a] pt-2 space-y-0.5">
									<div className="text-[#555] leading-7">
										! scaffold — 0 uses in 30d (0.9K wasted)
									</div>
									<div className="text-[#555] leading-7">
										! lint — 3 uses in 30d (2.1K, low ROI)
									</div>
								</div>
							</div>
							<div className="border-t border-[#1a1a1a]" />
							<div className="p-4">
								<div className="flex items-start gap-2 leading-7">
									<span className="text-[#555] select-none">$</span>
									<span className="text-white">skillkit prune</span>
								</div>
								<div className="mt-2 pt-2 border-t border-[#1a1a1a]">
									<div className="text-[#555] leading-7">
										Removed scaffold (0.9K)
									</div>
									<div className="text-[#555] leading-7">
										Removed lint (2.1K)
									</div>
									<div className="text-white leading-7">
										Reclaimed 3.0K · 10 skills active · 9.5K / 16.0K
									</div>
								</div>
							</div>
						</div>
					</motion.div>
				</div>
			</div>
		</section>
	);
}
