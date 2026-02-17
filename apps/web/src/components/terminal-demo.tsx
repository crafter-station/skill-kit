"use client";

import { useEffect, useRef, useState } from "react";

type OutputLine = {
	text: string;
	type: "output" | "success" | "header" | "empty";
};

type Step = {
	command: string;
	output: OutputLine[];
};

const STEPS: Step[] = [
	{
		command: "skill-kit stats",
		output: [
			{
				text: "  SKILL-KIT ANALYTICS (30d)",
				type: "header",
			},
			{ text: "", type: "empty" },
			{
				text: "  ▁▂▃▅▇█▆▅▇█  127 invocations across 12 skills",
				type: "success",
			},
			{
				text: "  Top: commit (42), review (38), deploy (27)",
				type: "output",
			},
		],
	},
	{
		command: "skill-kit health",
		output: [
			{
				text: "  SKILL-KIT HEALTH REPORT",
				type: "header",
			},
			{ text: "", type: "empty" },
			{
				text: "  Context budget: [████████░░] 78% (31.2K / 40K tokens)",
				type: "output",
			},
			{
				text: "  ⚠ 3 skills unused in 30 days — run skill-kit uninstall to reclaim context",
				type: "success",
			},
		],
	},
	{
		command: "skill-kit list",
		output: [
			{
				text: "  SKILL           SIZE     LAST USED    INVOCATIONS",
				type: "header",
			},
			{
				text: "  commit          1.2K     2h ago       42",
				type: "output",
			},
			{
				text: "  review          3.8K     1d ago       38",
				type: "output",
			},
			{
				text: "  deploy          0.9K     3d ago       27",
				type: "output",
			},
		],
	},
];

const CHAR_DELAY = 40;
const LINE_DELAY = 120;
const STEP_PAUSE = 600;
const LOOP_PAUSE = 4000;

type TerminalLine =
	| { kind: "prompt"; command: string; cursor: boolean }
	| { kind: "output"; line: OutputLine };

export function TerminalDemo() {
	const [lines, setLines] = useState<TerminalLine[]>([]);
	const [visible, setVisible] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) setVisible(true);
			},
			{ threshold: 0.3 },
		);
		if (containerRef.current) observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (!visible) return;

		let cancelled = false;

		const delay = (ms: number) =>
			new Promise<void>((resolve) => {
				animRef.current = setTimeout(resolve, ms);
			});

		const run = async () => {
			while (!cancelled) {
				setLines([]);

				for (const step of STEPS) {
					if (cancelled) break;

					let typed = "";
					setLines((prev) => [
						...prev,
						{ kind: "prompt", command: "", cursor: true },
					]);

					for (const char of step.command) {
						if (cancelled) break;
						await delay(CHAR_DELAY);
						typed += char;
						const cmd = typed;
						setLines((prev) => {
							const next = [...prev];
							next[next.length - 1] = {
								kind: "prompt",
								command: cmd,
								cursor: true,
							};
							return next;
						});
					}

					if (cancelled) break;

					setLines((prev) => {
						const next = [...prev];
						next[next.length - 1] = {
							kind: "prompt",
							command: step.command,
							cursor: false,
						};
						return next;
					});

					await delay(LINE_DELAY);

					for (const outputLine of step.output) {
						if (cancelled) break;
						await delay(LINE_DELAY);
						setLines((prev) => [...prev, { kind: "output", line: outputLine }]);
					}

					if (cancelled) break;
					await delay(STEP_PAUSE);
				}

				if (cancelled) break;
				await delay(LOOP_PAUSE);
			}
		};

		run();

		return () => {
			cancelled = true;
			if (animRef.current) clearTimeout(animRef.current);
		};
	}, [visible]);

	return (
		<div
			ref={containerRef}
			className="relative w-full max-w-2xl mx-auto"
			style={{
				filter: "drop-shadow(0 0 80px rgba(16,185,129,0.12))",
			}}
		>
			<div
				className="absolute inset-x-0 -top-16 h-32 pointer-events-none"
				style={{
					background:
						"radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.08) 0%, transparent 70%)",
				}}
			/>
			<div
				className="relative rounded-xl border border-zinc-800 overflow-hidden"
				style={{ boxShadow: "0 0 80px -20px rgba(16,185,129,0.2)" }}
			>
				<div
					className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800"
					style={{ background: "#0a0a0a" }}
				>
					<span
						className="w-3 h-3 rounded-full"
						style={{ background: "#ff5f57" }}
					/>
					<span
						className="w-3 h-3 rounded-full"
						style={{ background: "#febc2e" }}
					/>
					<span
						className="w-3 h-3 rounded-full"
						style={{ background: "#28c840" }}
					/>
					<span className="flex-1 text-center text-xs text-zinc-500 font-mono -ml-16">
						skill-kit
					</span>
				</div>
				<div
					className="p-5 font-mono text-sm min-h-[280px]"
					style={{ background: "#0a0a0a" }}
				>
					{lines.map((line, i) => {
						if (line.kind === "prompt") {
							return (
								<div key={i} className="flex items-start gap-2 leading-6">
									<span className="text-emerald-400 select-none">$</span>
									<span className="text-white">
										{line.command}
										{line.cursor && (
											<span
												className="inline-block w-[2px] h-[14px] ml-[1px] align-middle"
												style={{
													background: "#10b981",
													animation: "blink 1s step-end infinite",
												}}
											/>
										)}
									</span>
								</div>
							);
						}

						const { line: ol } = line;

						if (ol.type === "empty") {
							return <div key={i} className="h-3" />;
						}

						if (ol.type === "header") {
							return (
								<div key={i} className="text-zinc-500 leading-6">
									{ol.text}
								</div>
							);
						}

						if (ol.type === "success") {
							return (
								<div key={i} className="text-emerald-400 leading-6">
									{ol.text}
								</div>
							);
						}

						return (
							<div key={i} className="text-zinc-400 leading-6">
								{ol.text}
							</div>
						);
					})}
				</div>
			</div>
			<style>{`
				@keyframes blink {
					0%, 100% { opacity: 1; }
					50% { opacity: 0; }
				}
			`}</style>
		</div>
	);
}
