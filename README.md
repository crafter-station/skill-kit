# skillkit

Local-first analytics for AI agent skills. Track usage, measure context budget, and prune what you don't use.

```bash
npx @crafter/skillkit stats
```

Auto-discovers your skills, indexes sessions, and shows what matters. No setup needed.

## Why

AI coding agents load skills into their context window on every session. More skills = less room for your actual code. But which skills do you actually use? Which ones are wasting context budget?

**skillkit** answers these questions by scanning your session files, tracking invocations, and surfacing actionable insights - all locally on your machine.

## Commands

| Command | Description |
|---------|-------------|
| `stats` | Usage analytics with sparklines (auto-scans on first run) |
| `list` | List installed skills with size and context budget |
| `health` | Health check: unused skills, context budget, DB |
| `prune` | Remove unused skills to reclaim context budget |
| `scan` | Force re-scan (runs automatically, rarely needed) |

### Flags

| Flag | Applies to | Description |
|------|-----------|-------------|
| `--days N` | stats | Time range in days (default: 30) |
| `--all` | stats | Show all skills, not just top 10 |
| `--include-commands` | scan | Also track slash commands |
| `--claude` | any | Only scan Claude Code |
| `--opencode` | any | Only scan OpenCode |

Install skills via [skills.sh](https://skills.sh): `npx skills add <owner/repo>`

## Use as a Skill

Install skillkit as a skill so the agent can run analytics commands for you:

```bash
npx skills add crafter-station/skills --skill skillkit
```

Then ask your agent things like "which skills do I use the most?" or "clean up unused skills" and it will run the right commands.

## How It Works

### Stats

Auto-discovers skills on first run, parses session data from supported connectors, and shows sparkline trends.

```
$ npx @crafter/skillkit stats
  First run detected, scanning skills...
  Found 12 skills.

  SKILL-KIT ANALYTICS (last 30 days)

  Total invocations: 419
  Unique skills:     66
  Most active day:   Monday

  TOP SKILLS

  react-best-practices  ████████████████████   109  ▁▅▂▁▂▂█▅▁▂
  agent-browser         ██████████              56  ▂█▇▃▁▁▁▂▁▁▃▂▂▃▂
  pulse                 ██████                  32  ▁▁█▁▁▁▁▁
```

### Health

Checks context budget usage and flags unused skills.

```
$ npx @crafter/skillkit health
  [████████░░] 78% metadata budget (12.5K / 16.0K)
  ! 3 skills unused in 30d - run skillkit prune
```

### Prune

Removes skills that haven't been used in the last 30 days.

```
$ npx @crafter/skillkit prune
  x scaffold (0.9K)
  x lint (2.1K)

  2 skills - 3.0K context reclaimable

  Run with --yes to confirm deletion.
```

## Data Storage

All data stays on your machine:

| Path | Purpose |
|------|---------|
| `~/.skillkit/analytics.db` | SQLite database with invocation history |
| `~/.claude/skills/` | Claude Code skills (read-only) |
| `~/.local/share/opencode/skills/` | OpenCode skills (read-only) |
| `~/.claude/projects/**/*.jsonl` | Claude Code sessions (read-only) |
| `~/.local/share/opencode/opencode.db` | OpenCode sessions (read-only) |

On Windows, OpenCode paths use `%LOCALAPPDATA%\opencode\`.

## Supported Agents

Discovers and tracks skills for **Claude Code** and **OpenCode**.

- **Claude Code** - JSONL sessions (`~/.claude/projects/`)
- **OpenCode** - SQLite database (`opencode.db`)

Filter by agent with `--claude` or `--opencode`.

**Why only two?** Most agents (Cursor, Windsurf, Copilot, etc.) load skills as context rules injected into the prompt - there's no discrete "Skill" tool invocation in their session data. Claude Code and OpenCode are the only agents that invoke skills through a trackable tool call. If other agents adopt this pattern, adding a connector is straightforward.

## Project Structure

```
skill-kit/
├── apps/web/          # Landing page (Next.js)
├── packages/cli/      # CLI tool (Bun, zero deps)
└── packages/skill/    # Skill definition (SKILL.md)
```

## Development

```bash
bun install

# Run CLI locally
bun run packages/cli/src/bin.ts stats

# Run landing page
bun run --filter '@crafter/skillkit-web' dev

# Type check
bun run --filter '*' type-check

# Lint
biome check --write .
```

## License

MIT
