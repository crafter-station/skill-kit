import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "SkillKit - Local-First Analytics for AI Agent Skills",
	description:
		"Know which skills matter. Usage analytics, health checks, and context budget tracking for Claude Code, Cursor, Codex, and more. Powered by skills.sh.",
	metadataBase: new URL("https://skillkit.crafter.run"),
	openGraph: {
		title: "SkillKit",
		description:
			"Local-first analytics for AI agent skills. Usage tracking, health checks, and context budget analysis. Powered by skills.sh.",
		siteName: "SkillKit",
		url: "https://skillkit.crafter.run",
	},
	twitter: {
		card: "summary_large_image",
		title: "SkillKit",
		description:
			"Local-first analytics for AI agent skills. Session tracking for 14 agents, skill discovery across the 75-agent skills.sh ecosystem.",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="dark">
			<body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
				{children}
				<Analytics />
			</body>
		</html>
	);
}
