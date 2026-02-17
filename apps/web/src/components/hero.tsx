"use client";

import { ArrowRight, Check, Copy } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { TerminalDemo } from "./terminal-demo";

const INSTALL_CMD = "npx @crafter/skillkit";

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
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(INSTALL_CMD);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

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
							className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"
							aria-hidden="true"
						/>
						Powered by skills.sh
					</span>
				</motion.div>

				<motion.h1
					custom={1}
					initial="hidden"
					animate="visible"
					variants={fadeUp}
					className="text-5xl md:text-7xl font-serif italic tracking-tight text-white max-w-4xl leading-[1.05]"
				>
					Know which skills
					<br />
					actually matter
				</motion.h1>

				<motion.p
					custom={2}
					initial="hidden"
					animate="visible"
					variants={fadeUp}
					className="text-lg text-[#888] max-w-2xl leading-relaxed"
				>
					Local-first analytics for your AI agent skills. See what you use, what
					wastes context, and what to drop.
				</motion.p>

				<motion.div
					custom={3}
					initial="hidden"
					animate="visible"
					variants={fadeUp}
					className="flex flex-col items-center gap-4"
				>
					<div className="flex items-center gap-2 rounded-lg border border-[#222] bg-[#0a0a0a] px-4 py-3 font-mono text-sm">
						<span className="text-[#555] select-none">$</span>
						<span className="text-white">{INSTALL_CMD}</span>
						<button
							type="button"
							onClick={handleCopy}
							className="ml-3 shrink-0 text-[#555] hover:text-white transition-colors"
							aria-label="Copy install command"
						>
							{copied ? (
								<Check className="w-4 h-4 text-white" />
							) : (
								<Copy className="w-4 h-4" />
							)}
						</button>
					</div>
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
