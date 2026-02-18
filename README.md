# skillkit

Local-first analytics for AI agent skills. Track usage, measure context budget, and prune what you don't use.

## Why

AI coding agents load skills into their context window on every session. More skills = less room for your actual code. But which skills do you actually use? Which ones are wasting context budget?

**skillkit** answers these questions by scanning your session files, tracking invocations, and surfacing actionable insights - all locally on your machine.

## Quick Start

```bash
npx @crafter/skillkit scan
npx @crafter/skillkit stats
npx @crafter/skillkit health
```

## Commands

| Command | Description |
|---------|-------------|
| `skillkit scan` | Discover installed skills and index session data |
| `skillkit list` | List installed skills with size and context budget |
| `skillkit stats` | Usage analytics with sparklines (last 30 days) |
| `skillkit health` | Health check: unused skills, context budget, DB |
| `skillkit prune` | Remove unused skills to reclaim context budget |

Install skills via [skills.sh](https://skills.sh): `npx skills add <owner/repo>`

Already using skills.sh? Run `skillkit scan` to pick up everything you've installed and start tracking usage.

## Use as a Skill

Install skillkit as a Claude Code skill so the agent can run analytics commands for you:

```bash
npx skills add crafter-station/skill-kit
```

Then ask your agent things like "which skills do I use the most?" or "clean up unused skills" and it will run the right commands.

## How It Works

### Scan

Discovers skills across all detected agents and indexes session data from supported connectors. Detects whether each skill was installed via skills.sh or manually.

```
$ skillkit scan
  Scanning 3 agents: Claude Code, Cursor, OpenCode
  Found 12 skills (8 via skills.sh, 4 manual)
  Scanning sessions...
  Indexed 211 sessions · 1,847 invocations

  Ready. Run skillkit stats to see usage.
```

### Stats

Parses session data from supported connectors (Claude Code JSONL, OpenCode SQLite) and shows sparkline trends.

```
$ skillkit stats
  SKILL           ████████████████████  42  ▂▃▅▇█▆▅▇█
  commit          ████████████████████  42  ▂▃▅▇█▆▅▇█
  review          ████████████████      38  ▁▃▅▆▇▇▆▅▃
  deploy          ████████████          27  ▁▁▂▃▅▇█▇▅
```

### Health

Checks context budget usage and flags unused skills.

```
$ skillkit health
  [████████░░] 78% metadata budget (12.5K / 16.0K)
  ! 3 skills unused in 30d — run skillkit prune
```

### Prune

Removes skills that haven't been used in the last 30 days.

```
$ skillkit prune
  × scaffold (0.9K)
  × lint (2.1K)

  2 skills · 3.0K context reclaimable

  Run with --yes to confirm deletion.
```

## Data Storage

All data stays on your machine:

| Path | Purpose |
|------|---------|
| `~/.skillkit/analytics.db` | SQLite database with invocation history |
| `~/.{agent}/skills/` | Installed skills per agent (read-only) |
| `~/.claude/projects/**/*.jsonl` | Claude Code sessions (read-only) |
| `~/Library/Application Support/opencode/opencode.db` | OpenCode sessions (read-only) |

## Supported Agents

### Skill Discovery (15 agents)

Scans skill directories for all major agents:

- Claude Code, Cursor, Codex, Windsurf, Gemini CLI
- Cline, Roo Code, Continue, OpenCode, GitHub Copilot
- OpenHands, Amp, Goose, Kilo Code, Trae

Skills installed via [skills.sh](https://skills.sh) symlinks are deduplicated across agents.

### Usage Analytics (2 connectors)

Session scanning and invocation tracking:

- **Claude Code** — JSONL sessions (`~/.claude/projects/`)
- **OpenCode** — SQLite database (`opencode.db`)

More connectors coming as agents standardize session formats.

### Why not all agents?

Most agents (Cursor, Windsurf, Copilot, etc.) load skills as context rules injected into the prompt — there's no discrete "Skill" tool invocation in their session data. Claude Code and OpenCode are the only agents that invoke skills through a trackable tool call, which is what makes usage analytics possible. If other agents adopt a similar pattern, adding a connector is straightforward.

## Project Structure

```
skill-kit/
├── apps/web/          # Landing page (Next.js)
├── packages/cli/      # CLI tool (Bun, zero deps)
└── packages/skill/    # Claude Code skill (SKILL.md)
```

## Development

```bash
bun install

# Run CLI locally
bun run packages/cli/src/bin.ts scan

# Run landing page
bun run --filter '@crafter/skillkit-web' dev

# Type check
bun run --filter '*' type-check

# Lint
biome check --write .
```

## License

MIT
