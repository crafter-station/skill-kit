import { AgentLogoBelt } from "@/components/agent-logo-belt";
import { CommandsShowcase } from "@/components/commands-showcase";
import { ComparisonTable } from "@/components/comparison-table";
import { FAQ } from "@/components/faq";
import { FeatureBento } from "@/components/feature-bento";
import { FinalCTA } from "@/components/final-cta";
import { Hero } from "@/components/hero";
import { Navbar } from "@/components/navbar";
import { ObsidianCTA } from "@/components/obsidian-cta";
import { OpenSourceBlock } from "@/components/open-source-block";

export default function Home() {
	return (
		<div className="min-h-screen bg-[#0a0a0a] text-white">
			<Navbar />
			<main>
				<Hero />
				<AgentLogoBelt />
				<CommandsShowcase />
				<FeatureBento />
				<ComparisonTable />
				<OpenSourceBlock />
				<ObsidianCTA />
				<FAQ />
				<FinalCTA />
			</main>
			<footer className="border-t border-[#222] py-10 px-6">
				<div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
					<span className="font-mono font-bold text-sm text-[#666]">
						skillkit
					</span>
					<p className="text-xs text-[#444]">
						Built by{" "}
						<a
							href="https://github.com/crafter-station"
							target="_blank"
							rel="noopener noreferrer"
							className="text-[#666] hover:text-white transition-colors"
						>
							Crafter Station
						</a>
						. MIT License.
					</p>
				</div>
			</footer>
		</div>
	);
}
