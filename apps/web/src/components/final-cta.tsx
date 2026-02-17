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
					className="flex flex-col items-center gap-8"
				>
					<h2 className="text-4xl md:text-5xl font-serif italic text-white leading-tight">
						Stop guessing. Start measuring.
					</h2>
					<div className="w-full max-w-lg">
						<div className="flex items-center justify-between gap-3 rounded-lg border border-[#222] bg-[#0a0a0a] px-4 py-3 font-mono text-sm">
							<span className="text-[#888] truncate">{INSTALL_CMD}</span>
							<button
								type="button"
								onClick={handleCopy}
								className="shrink-0 text-[#555] hover:text-white transition-colors"
								aria-label="Copy install command"
							>
								{copied ? (
									<Check className="w-4 h-4 text-white" />
								) : (
									<Copy className="w-4 h-4" />
								)}
							</button>
						</div>
					</div>
					<div className="flex flex-wrap items-center justify-center gap-3">
						<a
							href="https://github.com/crafter-station/skill-kit#readme"
							target="_blank"
							rel="noopener noreferrer"
							className="px-6 py-2.5 rounded-md bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors"
						>
							Get Started
						</a>
						<a
							href="https://github.com/crafter-station/skill-kit"
							target="_blank"
							rel="noopener noreferrer"
							className="px-6 py-2.5 rounded-md border border-[#333] text-[#ccc] font-medium text-sm hover:border-[#555] hover:text-white transition-colors"
						>
							View Source
						</a>
					</div>
				</motion.div>
			</div>
		</section>
	);
}
