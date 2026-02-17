"use client";

import { Check, Copy } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

const INSTALL_CMD = "curl -fsSL skill-kit.dev/install | sh";

export function FinalCTA() {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(INSTALL_CMD);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<section className="relative py-32 px-6 overflow-hidden">
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					background:
						"radial-gradient(ellipse 60% 40% at 50% -5%, rgba(16,185,129,0.08) 0%, transparent 60%)",
				}}
			/>
			<div className="max-w-3xl mx-auto text-center relative">
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="flex flex-col items-center gap-8"
				>
					<h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
						Ready to level up your AI agent?
					</h2>
					<div className="w-full max-w-lg">
						<div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 font-mono text-sm">
							<span className="text-zinc-300 truncate">{INSTALL_CMD}</span>
							<button
								type="button"
								onClick={handleCopy}
								className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors"
								aria-label="Copy install command"
							>
								{copied ? (
									<Check className="w-4 h-4 text-emerald-400" />
								) : (
									<Copy className="w-4 h-4" />
								)}
							</button>
						</div>
					</div>
					<div className="flex flex-wrap items-center justify-center gap-3">
						<a
							href="#"
							className="px-6 py-2.5 rounded-md bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-400 transition-colors"
						>
							Get Started
						</a>
						<a
							href="#"
							className="px-6 py-2.5 rounded-md border border-zinc-700 text-zinc-300 font-medium text-sm hover:border-zinc-600 hover:text-white transition-colors"
						>
							Read the Docs
						</a>
					</div>
				</motion.div>
			</div>
		</section>
	);
}
