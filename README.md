# skill-kit

Local-first analytics for AI agent skills. Track usage, measure context budget, and find what to prune.

## Why

AI coding agents load skills into their context window on every session. More skills = less room for your actual code. But which skills do you actually use? Which ones are wasting context budget?

**skill-kit** answers these questions by scanning your session files, tracking invocations, and surfacing actionable insights - all locally on your machine.

## Quick Start

```bash
npx @crafter/skillkit scan
npx @crafter/skillkit stats
npx @crafter/skillkit health
```

## Commands

| Command | Description |
|---------|-------------|
| `skill-kit scan` | Discover installed skills and index session data |
| `skill-kit list` | List installed skills with size and context budget |
| `skill-kit stats` | Usage analytics with sparklines (last 30 days) |
| `skill-kit health` | Health check: unused skills, context budget, DB |

Install skills via [skills.sh](https://skills.sh): `npx skills add <owner/repo>`

Already using skills.sh? Run `skill-kit scan` to pick up everything you've installed and start tracking usage.

## How It Works

### Scan

Discovers skills from `~/.claude/skills/` and indexes session files from `~/.claude/projects/`. Detects whether each skill was installed via skills.sh or manually.

```
$ skill-kit scan
  Scanning ~/.claude/skills/ ...
  Found 12 skills (8 via skills.sh, 4 manual)
  Scanning sessions...
  Indexed 211 sessions · 1,847 invocations

  Ready. Run skill-kit stats to see usage.
```

### Stats

Parses JSONL session files for `Skill` tool_use blocks and shows sparkline trends.

```
$ skill-kit stats
  SKILL           ████████████████████  42  ▂▃▅▇█▆▅▇█
  commit          ████████████████████  42  ▂▃▅▇█▆▅▇█
  review          ████████████████      38  ▁▃▅▆▇▇▆▅▃
  deploy          ████████████          27  ▁▁▂▃▅▇█▇▅
```

### Health

Checks context budget usage and flags unused skills.

```
$ skill-kit health
  Budget: [████████░░] 78% (31.2K / 40K)
  ! 3 skills unused in 30d — run skill-kit uninstall <name>
```

## Data Storage

All data stays on your machine:

| Path | Purpose |
|------|---------|
| `~/.skill-kit/analytics.db` | SQLite database with invocation history |
| `~/.claude/skills/` | Installed skills (read-only) |
| `~/.claude/projects/**/*.jsonl` | Session files (read-only) |

## Supported Agents

Works with any agent that logs tool use in JSONL session files:

- Claude Code
- Cursor
- Codex
- VS Code (via extensions)
- Windsurf
- Gemini CLI

## Project Structure

```
skill-kit/
├── apps/web/          # Landing page (Next.js)
├── packages/cli/      # CLI tool (Bun, zero deps)
└── packages/skill/    # Shared skill types
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
