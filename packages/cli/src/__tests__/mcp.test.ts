import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	discoverMcpServers,
	type McpServerConfig,
	measureMcpServer,
	pickFailureReason,
} from "../scanner/mcp";

function tempProject(mcpJson?: unknown): string {
	const dir = mkdtempSync(join(tmpdir(), "skillkit-mcp-"));
	if (mcpJson !== undefined) {
		writeFileSync(join(dir, ".mcp.json"), JSON.stringify(mcpJson));
	}
	return dir;
}

describe("discoverMcpServers", () => {
	it("returns an empty list for a directory with no config", () => {
		const dir = tempProject();
		const servers = discoverMcpServers(dir);
		const fromRepo = servers.filter((s) => s.scope === "mcp-json");

		expect(fromRepo).toHaveLength(0);
	});

	it("reads servers from a repo-level .mcp.json", () => {
		const dir = tempProject({
			mcpServers: {
				local: { command: "bun", args: ["run", "server.ts"] },
			},
		});
		const server = discoverMcpServers(dir).find((s) => s.name === "local");

		expect(server).toBeDefined();
		expect(server?.scope).toBe("mcp-json");
		expect(server?.transport).toBe("stdio");
		expect(server?.command).toBe("bun");
		expect(server?.args).toEqual(["run", "server.ts"]);
	});

	it("infers stdio from a command and http from a url", () => {
		const dir = tempProject({
			mcpServers: {
				viaCommand: { command: "npx", args: ["-y", "some-server"] },
				viaUrl: { url: "https://example.com/mcp" },
			},
		});
		const servers = discoverMcpServers(dir);

		expect(servers.find((s) => s.name === "viaCommand")?.transport).toBe(
			"stdio",
		);
		expect(servers.find((s) => s.name === "viaUrl")?.transport).toBe("http");
	});

	it("honours an explicit type field over inference", () => {
		const dir = tempProject({
			mcpServers: {
				explicit: { type: "sse", url: "https://example.com/sse" },
			},
		});

		expect(
			discoverMcpServers(dir).find((s) => s.name === "explicit")?.transport,
		).toBe("sse");
	});

	it("marks a server with neither command nor url as unknown transport", () => {
		const dir = tempProject({ mcpServers: { broken: {} } });

		expect(
			discoverMcpServers(dir).find((s) => s.name === "broken")?.transport,
		).toBe("unknown");
	});

	it("survives malformed JSON without throwing", () => {
		const dir = mkdtempSync(join(tmpdir(), "skillkit-mcp-bad-"));
		writeFileSync(join(dir, ".mcp.json"), "{ not valid json");

		expect(() => discoverMcpServers(dir)).not.toThrow();
		expect(
			discoverMcpServers(dir).filter((s) => s.scope === "mcp-json"),
		).toHaveLength(0);
	});

	it("dedupes server names case-insensitively", () => {
		const dir = tempProject({
			mcpServers: {
				alphaXiv: { command: "a" },
				alphaxiv: { command: "b" },
			},
		});
		const matches = discoverMcpServers(dir).filter(
			(s) => s.name.toLowerCase() === "alphaxiv",
		);

		expect(matches).toHaveLength(1);
	});

	it("returns servers sorted by name", () => {
		const dir = tempProject({
			mcpServers: {
				zebra: { command: "a" },
				alpha: { command: "b" },
				middle: { command: "c" },
			},
		});
		const names = discoverMcpServers(dir)
			.filter((s) => s.scope === "mcp-json")
			.map((s) => s.name);

		expect(names).toEqual([...names].sort());
	});
});

describe("pickFailureReason", () => {
	it("prefers an error line over a trailing version banner", () => {
		const stderr = [
			"Error: Cannot find module 'excalidraw-mcp'",
			"Node.js v24.16.0",
		].join("\n");

		expect(pickFailureReason(stderr, 1)).toBe(
			"Error: Cannot find module 'excalidraw-mcp'",
		);
	});

	it("falls back to the exit code when stderr has no error line", () => {
		expect(pickFailureReason("Listening on stdio\n", 3)).toBe(
			"exited with code 3",
		);
	});

	it("reports an empty stderr without inventing a cause", () => {
		expect(pickFailureReason("", null)).toBe("server exited without output");
	});

	it("truncates a very long error line", () => {
		const reason = pickFailureReason(`Error: ${"x".repeat(500)}`, 1);

		expect(reason.length).toBeLessThanOrEqual(160);
		expect(reason.endsWith("...")).toBe(true);
	});
});

describe("measureMcpServer", () => {
	it("reports http transport as unsupported rather than zero", async () => {
		const config: McpServerConfig = {
			name: "remote",
			scope: "user",
			transport: "http",
			url: "https://example.com/mcp",
		};
		const result = await measureMcpServer(config);

		expect(result.status).toBe("unsupported");
		expect(result.chars).toBe(0);
		expect(result.reason).toContain("http");
	});

	it("reports a server that cannot start as failed, not measured", async () => {
		const config: McpServerConfig = {
			name: "ghost",
			scope: "user",
			transport: "stdio",
			command: "skillkit-nonexistent-binary-xyz",
			args: [],
		};
		const result = await measureMcpServer(config, 5_000);

		expect(result.status).toBe("failed");
		expect(result.toolCount).toBe(0);
		expect(result.reason).toBeTruthy();
	});

	it("times out a server that never answers", async () => {
		const config: McpServerConfig = {
			name: "silent",
			scope: "user",
			transport: "stdio",
			command: "sleep",
			args: ["30"],
		};
		const result = await measureMcpServer(config, 1_000);

		expect(result.status).toBe("timeout");
		expect(result.chars).toBe(0);
	});

	// A pipe that echoes stdin replays our own requests. Without a response
	// guard the echoed tools/list reads as a successful reply with zero tools,
	// silently reporting a broken server as free.
	it("does not treat an echoed request as a valid response", async () => {
		const config: McpServerConfig = {
			name: "echo",
			scope: "user",
			transport: "stdio",
			command: "cat",
			args: [],
		};
		const result = await measureMcpServer(config, 1_500);

		expect(result.status).not.toBe("ok");
		expect(result.chars).toBe(0);
	});
});
