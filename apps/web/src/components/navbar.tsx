"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export function Navbar() {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 8);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<header
			className={cn(
				"sticky top-0 z-50 w-full transition-all duration-200 backdrop-blur-md",
				scrolled
					? "border-b border-[#222] bg-[#0a0a0a]/80"
					: "bg-transparent",
			)}
		>
			<div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
				<span className="font-serif italic text-lg text-white">
					skill-kit
				</span>
				<nav className="flex items-center gap-1">
					<a
						href="https://github.com/crafter-station/skill-kit#readme"
						target="_blank"
						rel="noopener noreferrer"
						className="px-3 py-1.5 text-sm text-[#888] hover:text-white transition-colors rounded-md hover:bg-white/5"
					>
						Docs
					</a>
					<a
						href="https://github.com/crafter-station/skill-kit"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#888] hover:text-white transition-colors rounded-md hover:bg-white/5"
					>
						<Star className="w-3.5 h-3.5" aria-hidden="true" />
						GitHub
					</a>
					<a
						href="https://github.com/crafter-station/skill-kit#readme"
						target="_blank"
						rel="noopener noreferrer"
						className="ml-2 px-4 py-1.5 text-sm font-medium rounded-md bg-white text-black hover:bg-white/90 transition-colors"
					>
						Get Started
					</a>
				</nav>
			</div>
		</header>
	);
}
