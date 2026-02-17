import { AgentLogoBelt } from "@/components/agent-logo-belt";
import { ComparisonTable } from "@/components/comparison-table";
import { FAQ } from "@/components/faq";
import { FeatureBento } from "@/components/feature-bento";
import { FinalCTA } from "@/components/final-cta";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { Navbar } from "@/components/navbar";
import { OpenSourceBlock } from "@/components/open-source-block";
import { ProblemSection } from "@/components/problem-section";

export default function Home() {
	return (
		<div className="min-h-screen bg-zinc-950 text-zinc-50">
			<Navbar />
			<main>
				<Hero />
				<AgentLogoBelt />
				<ProblemSection />
				<HowItWorks />
				<FeatureBento />
				<ComparisonTable />
				<OpenSourceBlock />
				<FAQ />
				<FinalCTA />
			</main>
			<footer className="border-t border-zinc-800 py-10 px-6">
				<div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
					<span className="font-mono font-bold text-sm text-zinc-400">
						skill-kit
					</span>
					<p className="text-xs text-zinc-600">
						Built by{" "}
						<a
							href="https://github.com/crafter-station"
							target="_blank"
							rel="noopener noreferrer"
							className="text-zinc-500 hover:text-zinc-300 transition-colors"
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
