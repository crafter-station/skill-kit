"use client";

import { Check, Copy } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

const INSTALL_CMD = "npx @crafter/skillkit";

export function FinalCTA() {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(INSTALL_CMD);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<section className="relative py-32 px-6 overflow-hidden">
			<div className="max-w-3xl mx-auto text-center relative">
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="flex flex-col items-center gap-6"
				>
					<h2 className="text-4xl md:text-5xl font-serif italic text-white leading-tight">
						Stop guessing. Start measuring.
					</h2>
					<p className="text-[#555] text-sm">
						One command. No signup. No telemetry.
					</p>
					<button
						type="button"
						onClick={handleCopy}
						className="group flex items-center gap-3 rounded-lg border border-[#222] hover:border-[#444] bg-[#0a0a0a] px-5 py-3.5 font-mono text-sm transition-colors"
					>
						<span className="text-[#555]">$</span>
						<span className="text-white">{INSTALL_CMD}</span>
						<span className="ml-2 text-[#333] group-hover:text-[#666] transition-colors">
							{copied ? (
								<Check className="w-4 h-4 text-white" />
							) : (
								<Copy className="w-4 h-4" />
							)}
						</span>
					</button>
				</motion.div>
			</div>
		</section>
	);
}
