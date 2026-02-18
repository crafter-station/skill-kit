import { ImageResponse } from "@takumi-rs/image-response";

export const alt = "SkillKit - Analytics for AI Agent Skills";
export const size = { width: 1200, height: 600 };
export const contentType = "image/png";

export default function Image() {
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
						fontFamily: "Geist",
						letterSpacing: "-0.02em",
						fontVariationSettings: "'wght' 400",
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
					<span style={{ fontSize: 24, color: "#666666" }}>$</span>
					<span
						tw="text-white"
						style={{ fontSize: 24, fontFamily: "Geist Mono" }}
					>
						npx @crafter/skillkit
					</span>
				</div>
			</div>
		</div>,
		{ ...size },
	);
}
