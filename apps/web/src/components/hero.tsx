"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
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
		<section className="relative pt-24 pb-20 px-6 overflow-hidden">
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					background:
						"radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16,185,129,0.07) 0%, transparent 60%)",
				}}
			/>
			<div className="max-w-6xl mx-auto flex flex-col items-center text-center gap-6">
				<motion.div
					custom={0}
					initial="hidden"
					animate="visible"
					variants={fadeUp}
				>
					<span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs font-medium tracking-wide">
						<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
						Open Source
					</span>
				</motion.div>

				<motion.h1
					custom={1}
					initial="hidden"
					animate="visible"
					variants={fadeUp}
					className="text-5xl md:text-6xl font-bold tracking-tight text-white max-w-3xl leading-[1.1]"
				>
					Know which skills actually matter
				</motion.h1>

				<motion.p
					custom={2}
					initial="hidden"
					animate="visible"
					variants={fadeUp}
					className="text-lg text-zinc-400 max-w-2xl leading-relaxed"
				>
					Local-first analytics for your AI agent skills. See what you use, what
					wastes context, and what to drop. Powered by skills.sh.
				</motion.p>

				<motion.div
					custom={3}
					initial="hidden"
					animate="visible"
					variants={fadeUp}
					className="flex flex-wrap items-center justify-center gap-3"
				>
					<a
						href="#"
						className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-400 transition-colors"
					>
						Get Started
					</a>
					<a
						href="https://github.com/crafter-station/skill-kit"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-2 px-5 py-2.5 rounded-md border border-zinc-700 text-zinc-300 font-medium text-sm hover:border-zinc-600 hover:text-white transition-colors"
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
