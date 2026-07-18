"use client";

import { useEffect, useRef, useState } from "react";

type OutputLine = {
	text: string;
	type: "output" | "highlight" | "header" | "empty";
};

type Step = {
	command: string;
	output: OutputLine[];
};

const STEPS: Step[] = [
	{
		command: "skillkit stats",
		output: [
			{ text: "  Scanning sessions...", type: "output" },
			{ text: "", type: "empty" },
			{ text: "  SKILL-KIT ANALYTICS (last 30 days)", type: "header" },
			{ text: "", type: "empty" },
			{ text: "  Total invocations: 1866", type: "output" },
			{ text: "  Unique skills:     63", type: "output" },
			{ text: "  Most active day:   Monday", type: "output" },
			{ text: "", type: "empty" },
			{ text: "  Current streak:    12 days 🔥", type: "highlight" },
			{ text: "  Longest streak:    12 days", type: "output" },
			{ text: "  This week:         $999.42 vs $6034 (-83%)", type: "output" },
		],
	},
	{
		command: "skillkit sessions --days 7",
		output: [
			{ text: "  SESSIONS (last 7 days)", type: "header" },
			{ text: "", type: "empty" },
			{ text: "  Total: $6695.61  in 541K / 4.7M tokens", type: "highlight" },
			{ text: "", type: "empty" },
			{ text: "  2026-03-30 Mon   $535.97   claude", type: "output" },
			{ text: "  2026-03-29 Sun   $463.45   claude", type: "output" },
			{ text: "  2026-03-28 Sat   $976.39   claude", type: "output" },
			{ text: "  2026-03-27 Fri  $1311.49   claude", type: "output" },
		],
	},
	{
		command: "skillkit graph",
		output: [
			{ text: "  CONTRIBUTION GRAPH (all agents)", type: "header" },
			{ text: "", type: "empty" },
			{ text: "       Mar        Apr        May", type: "output" },
			{ text: "  Mon  . . . . .  # . . # #  . .", type: "output" },
			{ text: "  Tue  . . . . .  . . . . #  . .", type: "output" },
			{ text: "  Wed  . . . . .  . # . . #  # .", type: "highlight" },
			{ text: "  Thu  . . . . .  # . # . .  . .", type: "output" },
			{ text: "  Fri  . . . . .  . . . # #  # #", type: "highlight" },
			{ text: "  Sat  . . . . .  . . . . #  . .", type: "output" },
			{ text: "  Sun  . . . . .  . . # . .  . #", type: "output" },
			{ text: "", type: "empty" },
			{ text: "  Active days: 18  Total: $7,859", type: "output" },
		],
	},
];

const CHAR_DELAY = 40;
const LINE_DELAY = 100;
const STEP_PAUSE = 800;

type TerminalLine =
	| { kind: "prompt"; command: string; cursor: boolean }
	| { kind: "output"; line: OutputLine }
	| { kind: "separator" };

export function TerminalDemo() {
	const [lines, setLines] = useState<TerminalLine[]>([]);
	const [visible, setVisible] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

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

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new lines
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [lines]);

	useEffect(() => {
		if (!visible) return;

		let cancelled = false;

		const delay = (ms: number) =>
			new Promise<void>((resolve) => {
				animRef.current = setTimeout(resolve, ms);
			});

		const run = async () => {
			setLines([]);

			for (let stepIdx = 0; stepIdx < STEPS.length; stepIdx++) {
				const step = STEPS[stepIdx] as Step;
				if (cancelled) break;

				if (stepIdx > 0) {
					setLines((prev) => [...prev, { kind: "separator" }]);
					await delay(200);
				}

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

		};

		run();

		return () => {
			cancelled = true;
			if (animRef.current) clearTimeout(animRef.current);
		};
	}, [visible]);

	return (
		<div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
			<div className="relative rounded-xl border border-[#222] overflow-hidden">
				<div
					className="flex items-center gap-2 px-4 py-3 border-b border-[#222]"
					style={{ background: "#0a0a0a" }}
				>
					<span className="w-3 h-3 rounded-full bg-[#333]" />
					<span className="w-3 h-3 rounded-full bg-[#333]" />
					<span className="w-3 h-3 rounded-full bg-[#333]" />
					<span className="flex-1 text-center text-xs text-[#555] font-mono -ml-16">
						skillkit
					</span>
					<span className="text-[10px] font-mono text-[#333] tracking-wider uppercase">
						normal
					</span>
				</div>
				<div
					ref={scrollRef}
					className="p-5 font-mono text-sm h-[380px] overflow-y-auto"
					style={{ background: "#0a0a0a" }}
				>
					{lines.map((line, i) => {
						if (line.kind === "separator") {
							return <div key={i} className="border-t border-[#1a1a1a] my-3" />;
						}

						if (line.kind === "prompt") {
							return (
								<div key={i} className="flex items-start gap-2 leading-6">
									<span className="text-[#555] select-none">$</span>
									<span className="text-white">
										{line.command}
										{line.cursor && <span className="vim-cursor">&nbsp;</span>}
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
								<div key={i} className="text-[#555] leading-6">
									{ol.text}
								</div>
							);
						}

						if (ol.type === "highlight") {
							return (
								<div key={i} className="text-white leading-6">
									{ol.text}
								</div>
							);
						}

						return (
							<div key={i} className="text-[#888] leading-6">
								{ol.text}
							</div>
						);
					})}
				</div>
				<div
					className="flex items-center justify-between px-4 py-1.5 border-t border-[#222] text-[10px] font-mono text-[#444]"
					style={{ background: "#0e0e0e" }}
				>
					<span>-- NORMAL --</span>
					<span>skillkit v0.10</span>
					<span>utf-8</span>
				</div>
			</div>
			<style>{`
				.vim-cursor {
					display: inline-block;
					width: 8px;
					height: 16px;
					background: white;
					vertical-align: text-bottom;
					animation: vim-blink 1.2s step-end infinite;
				}
				@keyframes vim-blink {
					0%, 70% { opacity: 1; }
					71%, 100% { opacity: 0; }
				}
			`}</style>
		</div>
	);
}
