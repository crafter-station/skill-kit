"use client";

import { motion } from "motion/react";
import type { ComponentType } from "react";
import {
	ClaudeLogo,
	CursorLogo,
	GeminiLogo,
	GithubLogo,
	OpenAILogo,
} from "./logos/agent-logos";

type AgentEntry = {
	name: string;
	logo?: ComponentType<{ className?: string }>;
	supported?: boolean;
};

const AGENTS: AgentEntry[] = [
	{ name: "Claude Code", logo: ClaudeLogo, supported: true },
	{ name: "OpenCode", supported: true },
	{ name: "Cursor", logo: CursorLogo },
	{ name: "Codex", logo: OpenAILogo },
	{ name: "Windsurf" },
	{ name: "Gemini CLI", logo: GeminiLogo },
	{ name: "Cline" },
	{ name: "Roo Code" },
	{ name: "GitHub Copilot", logo: GithubLogo },
	{ name: "OpenHands" },
	{ name: "Goose" },
	{ name: "Kilo Code" },
	{ name: "Trae" },
];

function AgentInitial({ name }: { name: string }) {
	const initial = name
		.split(" ")
		.map((w) => w[0])
		.join("")
		.slice(0, 2);
	return (
		<span className="w-4 h-4 flex items-center justify-center text-[10px] font-mono font-medium">
			{initial}
		</span>
	);
}

export function AgentLogoBelt() {
	return (
		<section className="py-16 px-6 border-y border-[#1a1a1a]">
			<div className="max-w-6xl mx-auto flex flex-col items-center gap-8">
				<p className="text-xs text-[#555] uppercase tracking-widest font-medium">
					Works with your agent
				</p>
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="flex flex-wrap items-center justify-center gap-3"
				>
					{AGENTS.map((agent) => {
						const Logo = agent.logo;
						return (
							<span
								key={agent.name}
								className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-mono text-sm ${
									agent.supported
										? "border-[#333] text-white"
										: "border-[#1a1a1a] text-[#444]"
								}`}
							>
								{Logo ? (
									<Logo className="w-4 h-4" />
								) : (
									<AgentInitial name={agent.name} />
								)}
								{agent.name}
							</span>
						);
					})}
				</motion.div>
			</div>
		</section>
	);
}
