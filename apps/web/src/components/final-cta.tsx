"use client";

import { motion } from "motion/react";
import { InstallCommand } from "./install-command";

export function FinalCTA() {
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
					<InstallCommand location="cta" />
				</motion.div>
			</div>
		</section>
	);
}
