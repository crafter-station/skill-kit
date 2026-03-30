"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { InstallCommand } from "./install-command";
import { TerminalDemo } from "./terminal-demo";

const fadeUp = {
	hidden: { opacity: 0, y: 24 },
	visible: (i: number) => ({
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.5,
			delay: i * 0.1,
			ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
		},
	}),
};

export function Hero() {
	return (
		<section className="relative pt-32 pb-20 px-6 overflow-hidden">
			<div className="max-w-6xl mx-auto flex flex-col items-center text-center gap-6">
				<motion.div
					custom={0}
					initial="hidden"
					animate="visible"
					variants={fadeUp}
				>
					<span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#333] bg-white/5 text-[#888] text-xs font-mono tracking-wide">
						<span
							className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
							aria-hidden="true"
						/>
						v0.10 — sessions, streaks, graphs
					</span>
				</motion.div>

				<motion.h1
					custom={1}
					initial="hidden"
					animate="visible"
					variants={fadeUp}
					className="text-5xl md:text-7xl font-serif italic tracking-tight text-white max-w-4xl leading-[1.05]"
				>
					Know what your
					<br />
					AI agents cost
				</motion.h1>

				<motion.p
					custom={2}
					initial="hidden"
					animate="visible"
					variants={fadeUp}
					className="text-lg text-[#888] max-w-2xl leading-relaxed"
				>
					Observability for AI coding agents. Track burn rate, sessions, streaks,
					and contribution graphs across Claude, Cursor, Codex, and 9 more — all local, all offline.
				</motion.p>

				<motion.div
					custom={3}
					initial="hidden"
					animate="visible"
					variants={fadeUp}
					className="flex flex-col items-center gap-4"
				>
					<InstallCommand location="hero" />
					<a
						href="https://github.com/crafter-station/skill-kit"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-2 text-[#888] text-sm hover:text-white transition-colors"
					>
						View on GitHub
						<ArrowRight className="w-4 h-4" />
					</a>
				</motion.div>

				<motion.div
					custom={4}
					initial="hidden"
					animate="visible"
					variants={fadeUp}
					className="w-full mt-8"
				>
					<TerminalDemo />
				</motion.div>
			</div>
		</section>
	);
}
