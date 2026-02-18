import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SkillKit - Local-First Analytics for AI Agent Skills";
export const size = { width: 1200, height: 600 };
export const contentType = "image/png";

export default async function Image() {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				alignItems: "center",
				background: "#0a0a0a",
				position: "relative",
			}}
		>
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background:
						"radial-gradient(circle at 50% 50%, #181818 0%, #0a0a0a 70%)",
					display: "flex",
				}}
			/>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 28,
					zIndex: 1,
				}}
			>
				<span
					style={{
						fontSize: 120,
						fontStyle: "italic",
						color: "#fafafa",
						fontFamily: "Georgia, serif",
						letterSpacing: "-0.02em",
					}}
				>
					skillkit
				</span>

				<div
					style={{
						fontSize: 32,
						color: "#999999",
						fontFamily: "system-ui, sans-serif",
						letterSpacing: "0.08em",
						textTransform: "uppercase",
					}}
				>
					Analytics for AI agent skills
				</div>

				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 10,
						marginTop: 32,
						padding: "16px 32px",
						border: "1px solid #333333",
						borderRadius: 10,
						background: "#141414",
					}}
				>
					<span
						style={{ fontSize: 24, color: "#666666", fontFamily: "monospace" }}
					>
						$
					</span>
					<span
						style={{ fontSize: 24, color: "#fafafa", fontFamily: "monospace" }}
					>
						npx @crafter/skillkit
					</span>
				</div>
			</div>
		</div>,
		{ ...size },
	);
}
