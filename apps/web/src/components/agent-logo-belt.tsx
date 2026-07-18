"use client";

import { motion } from "motion/react";
import type { ComponentType } from "react";
import {
	ClaudeLogo,
	ClineLogo,
	CursorLogo,
	GeminiLogo,
	GithubCopilotLogo,
	GooseLogo,
	KiloCodeLogo,
	OpenAILogo,
	OpenCodeLogo,
	OpenHandsLogo,
	RooCodeLogo,
	TraeLogo,
	WindsurfLogo,
} from "./logos/agent-logos";

const REPO = "https://github.com/crafter-station/skill-kit/issues";

type AgentEntry = {
	name: string;
	logo?: ComponentType<{ className?: string }>;
	supported?: boolean;
	issue?: number;
};

const AGENTS: AgentEntry[] = [
	{ name: "Claude Code", logo: ClaudeLogo, supported: true },
	{ name: "Cursor", logo: CursorLogo, supported: true },
	{ name: "Codex", logo: OpenAILogo, supported: true },
	{ name: "Gemini CLI", logo: GeminiLogo, supported: true },
	{ name: "OpenCode", logo: OpenCodeLogo, supported: true },
	{ name: "Windsurf", logo: WindsurfLogo, issue: 3 },
	{ name: "Cline", logo: ClineLogo, issue: 5 },
	{ name: "Roo Code", logo: RooCodeLogo, issue: 6 },
	{ name: "Continue", issue: 7 },
	{ name: "Amp", issue: 10 },
	{ name: "GitHub Copilot", logo: GithubCopilotLogo, issue: 8 },
	{ name: "OpenHands", logo: OpenHandsLogo, issue: 9 },
	{ name: "Goose", logo: GooseLogo, issue: 11 },
	{ name: "Kilo Code", logo: KiloCodeLogo, issue: 12 },
	{ name: "Trae", logo: TraeLogo, issue: 13 },
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

function AgentIcon({ agent }: { agent: AgentEntry }) {
	const Logo = agent.logo;
	if (Logo) return <Logo className="w-4 h-4" />;
	return <AgentInitial name={agent.name} />;
}

export function AgentLogoBelt() {
	const supported = AGENTS.filter((a) => a.supported);
	const planned = AGENTS.filter((a) => !a.supported);

	return (
		<section className="py-16 px-6 border-y border-[#1a1a1a]">
			<div className="max-w-6xl mx-auto flex flex-col items-center gap-10">
				<div className="flex flex-col items-center gap-4">
					<p className="text-xs text-[#555] uppercase tracking-widest font-medium">
						Supported agents
					</p>
					<div className="flex flex-wrap items-center justify-center gap-3">
						{supported.map((agent) => (
							<span
								key={agent.name}
								className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#333] text-white font-mono text-sm"
							>
								<AgentIcon agent={agent} />
								{agent.name}
							</span>
						))}
					</div>
				</div>

				<div className="flex flex-col items-center gap-4">
					<p className="text-xs text-[#333] uppercase tracking-widest font-medium">
						Coming soon
					</p>
					<motion.div
						initial={{ opacity: 0, y: 12 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5 }}
						className="flex flex-wrap items-center justify-center gap-2"
					>
						{planned.map((agent) => (
							<a
								key={agent.name}
								href={`${REPO}/${agent.issue}`}
								target="_blank"
								rel="noopener noreferrer"
								className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1a1a1a] text-[#333] font-mono text-xs transition-colors hover:border-[#333] hover:text-[#888]"
							>
								<AgentIcon agent={agent} />
								{agent.name}
								<span className="opacity-0 group-hover:opacity-100 transition-opacity text-[#555]">
									+1
								</span>
							</a>
						))}
					</motion.div>
				</div>
			</div>
		</section>
	);
}
