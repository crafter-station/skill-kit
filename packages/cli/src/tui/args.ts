const AGENT_FLAGS: Record<string, string> = {
	"--claude": "claude",
	"--cursor": "cursor",
	"--codex": "codex",
	"--gemini": "gemini",
	"--opencode": "opencode",
	"--windsurf": "windsurf",
	"--amp": "amp",
	"--continue": "continue",
	"--goose": "goose",
	"--kiro": "kiro",
	"--roo": "roo",
	"--antigravity": "antigravity",
	"--cline": "cline",
	"--kilocode": "kilocode",
	"--copilot": "copilot",
	"--openhands": "openhands",
};

export function parseAgentFilter(args: string[]): string | undefined {
	for (const [flag, id] of Object.entries(AGENT_FLAGS)) {
		if (args.includes(flag)) return id;
	}
	return undefined;
}
