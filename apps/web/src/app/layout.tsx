import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "SkillKit - The Package Manager for AI Agent Skills",
	description:
		"Install, manage, and discover skills for Claude Code, Cursor, Codex, and more. One command. Every skill. Any agent. Open source.",
	openGraph: {
		title: "SkillKit",
		description:
			"The package manager for AI agent skills. Install, manage, and discover skills for Claude Code, Cursor, Codex, and more.",
		siteName: "SkillKit",
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
			</body>
		</html>
	);
}
