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

Or install globally:

```bash
npm i -g @crafter/skillkit
skillkit scan
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

## How It Works

### Scan

Discovers skills from `~/.claude/skills/` and indexes session files from `~/.claude/projects/`. Detects whether each skill was installed via skills.sh or manually.

```
$ skillkit scan
  Scanning ~/.claude/skills/ ...
  Found 12 skills (8 via skills.sh, 4 manual)
  Scanning sessions...
  Indexed 211 sessions · 1,847 invocations

  Ready. Run skillkit stats to see usage.
```

### Stats

Parses JSONL session files for `Skill` tool_use blocks and shows sparkline trends.

```
$ skillkit stats
  SKILL           ████████████████████  42  ▂▃▅▇█▆▅▇█
  commit          ████████████████████  42  ▂▃▅▇█▆▅▇█
  review          ████████████████      38  ▁▃▅▆▇▇▆▅▃
  deploy          ████████████          27  ▁▁▂▃▅▇█▇▅
```

### Health

Checks metadata budget usage (name + description loaded at startup) and flags unused skills.

```
$ skillkit health
  [████████░░] 78% metadata budget (12.5K / 16.0K)
  ! 3 skills unused in 30d — run skillkit prune
```

### Prune

Removes skills that haven't been used in the last 30 days.

```
$ skillkit prune
  x scaffold (0.9K)
  x lint (2.1K)

  2 skills · 3.0K context reclaimable

  Run with --yes to confirm deletion.
```

## Data Storage

All data stays on your machine. No telemetry. No signup.

| Path | Purpose |
|------|---------|
| `~/.skillkit/analytics.db` | SQLite database with invocation history |
| `~/.claude/skills/` | Installed skills (read-only) |
| `~/.claude/projects/**/*.jsonl` | Session files (read-only) |

## Supported Agents

Scans skill directories for 15+ agents automatically:

- Claude Code, Cursor, Codex, Windsurf, Gemini CLI
- Cline, Roo Code, Continue, OpenCode, GitHub Copilot
- OpenHands, Amp, Goose, Kilo Code, Trae

Skills installed via [skills.sh](https://skills.sh) symlinks are deduplicated across agents.

## License

MIT
