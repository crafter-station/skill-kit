import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SkillKit - Local-First Analytics for AI Agent Skills";
export const size = { width: 1200, height: 630 };
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
						"radial-gradient(circle at 50% 50%, #141414 0%, #0a0a0a 70%)",
					display: "flex",
				}}
			/>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 24,
					zIndex: 1,
				}}
			>
				<span
					style={{
						fontSize: 96,
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
						fontSize: 28,
						color: "#a3a3a3",
						fontFamily: "system-ui, sans-serif",
						letterSpacing: "0.08em",
						textTransform: "uppercase",
					}}
				>
					Local analytics for AI agent skills
				</div>

				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginTop: 32,
						padding: "14px 28px",
						border: "1px solid #222222",
						borderRadius: 8,
						background: "#141414",
					}}
				>
					<span style={{ fontSize: 20, color: "#555555", fontFamily: "monospace" }}>
						$
					</span>
					<span style={{ fontSize: 20, color: "#fafafa", fontFamily: "monospace" }}>
						npx @crafter/skillkit
					</span>
				</div>
			</div>

			<div
				style={{
					position: "absolute",
					bottom: 32,
					display: "flex",
					alignItems: "center",
					gap: 8,
				}}
			>
				<span
					style={{
						fontSize: 16,
						color: "#333333",
						fontFamily: "system-ui, sans-serif",
					}}
				>
					Powered by skills.sh
				</span>
			</div>
		</div>,
		{ ...size },
	);
}
