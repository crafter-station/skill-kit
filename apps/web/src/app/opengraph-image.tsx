import type { Font } from "@takumi-rs/core";
import { ImageResponse } from "@takumi-rs/image-response";

export const alt = "SkillKit - Analytics for AI Agent Skills";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const serifUrl =
	"https://raw.githubusercontent.com/google/fonts/main/ofl/sourceserif4/SourceSerif4-Italic%5Bopsz%2Cwght%5D.ttf";

export default async function Image() {
	const serifData = await fetch(serifUrl).then((r) => r.arrayBuffer());
	const fonts: Font[] = [
		{ name: "Serif", data: serifData, style: "italic", weight: 400 },
	];

	return new ImageResponse(
		<div
			tw="flex h-full w-full flex-col items-center justify-center relative"
			style={{ background: "#0a0a0a" }}
		>
			<div
				tw="absolute inset-0"
				style={{
					background:
						"radial-gradient(circle at 50% 50%, #181818 0%, #0a0a0a 70%)",
				}}
			/>

			<div tw="flex flex-col items-center z-10" style={{ gap: 28 }}>
				<span
					tw="text-white italic"
					style={{
						fontSize: 120,
						fontFamily: "Serif",
						letterSpacing: "-0.02em",
					}}
				>
					skillkit
				</span>

				<span
					tw="uppercase"
					style={{
						fontSize: 32,
						color: "#999999",
						letterSpacing: "0.08em",
						fontFamily: "Geist",
					}}
				>
					Analytics for AI agent skills
				</span>

				<div
					tw="flex items-center mt-8"
					style={{
						gap: 10,
						padding: "16px 32px",
						border: "1px solid #333333",
						borderRadius: 10,
						background: "#141414",
					}}
				>
					<span style={{ fontSize: 24, color: "#666666", fontFamily: "Geist Mono" }}>$</span>
					<span
						tw="text-white"
						style={{ fontSize: 24, fontFamily: "Geist Mono" }}
					>
						npx @crafter/skillkit
					</span>
				</div>
			</div>

			<div tw="absolute bottom-9 flex items-center" style={{ gap: 8 }}>
				<span style={{ fontSize: 18, color: "#555555", fontFamily: "Geist" }}>
					Powered by skills.sh
				</span>
			</div>
		</div>,
		{ ...size, fonts },
	);
}
