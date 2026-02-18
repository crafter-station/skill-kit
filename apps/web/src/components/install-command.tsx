"use client";

import { track } from "@vercel/analytics";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

type PackageManager = "bun" | "npm" | "pnpm";

const COMMANDS: Record<
	PackageManager,
	{ tryIt: { display: string; copy: string }; global: { display: string; copy: string } }
> = {
	bun: {
		tryIt: { display: "bunx @crafter/skillkit", copy: "bunx @crafter/skillkit@latest" },
		global: { display: "bun add -g @crafter/skillkit", copy: "bun add -g @crafter/skillkit" },
	},
	npm: {
		tryIt: { display: "npx @crafter/skillkit", copy: "npx @crafter/skillkit@latest" },
		global: { display: "npm install -g @crafter/skillkit", copy: "npm install -g @crafter/skillkit" },
	},
	pnpm: {
		tryIt: { display: "pnpm dlx @crafter/skillkit", copy: "pnpm dlx @crafter/skillkit@latest" },
		global: { display: "pnpm add -g @crafter/skillkit", copy: "pnpm add -g @crafter/skillkit" },
	},
};

const PM_LABELS: { id: PackageManager; label: string }[] = [
	{ id: "bun", label: "bun" },
	{ id: "npm", label: "npm" },
	{ id: "pnpm", label: "pnpm" },
];

type InstallMode = "try" | "global";

export function InstallCommand({ location }: { location: "hero" | "cta" }) {
	const [pm, setPm] = useState<PackageManager>("npm");
	const [mode, setMode] = useState<InstallMode>("try");
	const [copied, setCopied] = useState(false);

	const { display, copy } = mode === "try" ? COMMANDS[pm].tryIt : COMMANDS[pm].global;

	const handleCopy = async () => {
		await navigator.clipboard.writeText(copy);
		setCopied(true);
		track("install_copy", { pm, mode, location });
		setTimeout(() => setCopied(false), 2000);
	};

	const handlePmChange = (newPm: PackageManager) => {
		setPm(newPm);
		track("install_pm_switch", { pm: newPm, location });
	};

	const handleModeChange = (newMode: InstallMode) => {
		setMode(newMode);
		track("install_mode_switch", { mode: newMode, location });
	};

	return (
		<div className="flex flex-col items-center gap-3 w-full max-w-lg">
			<div className="flex items-center gap-1 p-0.5 rounded-md bg-[#111] border border-[#222]">
				{PM_LABELS.map(({ id, label }) => (
					<button
						key={id}
						type="button"
						onClick={() => handlePmChange(id)}
						className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
							pm === id
								? "bg-[#222] text-white"
								: "text-[#555] hover:text-[#888]"
						}`}
					>
						{label}
					</button>
				))}
			</div>

			<div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest">
				<button
					type="button"
					onClick={() => handleModeChange("try")}
					className={`px-2 py-0.5 rounded transition-colors ${
						mode === "try" ? "text-white" : "text-[#444] hover:text-[#666]"
					}`}
				>
					Try it
				</button>
				<span className="text-[#333]">/</span>
				<button
					type="button"
					onClick={() => handleModeChange("global")}
					className={`px-2 py-0.5 rounded transition-colors ${
						mode === "global" ? "text-white" : "text-[#444] hover:text-[#666]"
					}`}
				>
					Install globally
				</button>
			</div>

			<button
				type="button"
				onClick={handleCopy}
				className="group flex items-center gap-2 rounded-lg border border-[#222] hover:border-[#444] bg-[#0a0a0a] px-4 py-3 font-mono text-sm transition-colors w-full justify-center"
			>
				<span className="text-[#555] select-none">$</span>
				<span className="text-white">{display}</span>
				<span className="ml-2 shrink-0 text-[#333] group-hover:text-[#666] transition-colors">
					{copied ? (
						<Check className="w-4 h-4 text-white" />
					) : (
						<Copy className="w-4 h-4" />
					)}
				</span>
			</button>
		</div>
	);
}
