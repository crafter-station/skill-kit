# skillkit

Local-first observability for AI agent skills. Track usage, measure cost, detect conflicts, and prune what you don't use.

## Why

AI coding agents load skills into their context window on every session. More skills = less room for your actual code. But which skills do you actually use? Are they helping? How much do they cost?

**skillkit** answers these questions with usage analytics, conflict detection, cost analysis, and context budget monitoring — all locally on your machine.

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
| `skillkit burn` | Subscription burn rate analysis (cost, models, daily) |
| `skillkit conflicts` | Test skills for trigger collisions |
| `skillkit coverage <skill-path>` | Analyze dead weight in a skill |
| `skillkit trace <prompt>` | Run and record a skill execution trace |

Install skills via [skills.sh](https://skills.sh): `npx skills add <owner/repo>`

## skill-creator vs skillkit

Anthropic's [skill-creator](https://github.com/anthropics/skill-creator) handles skill **authoring and evaluation**. skillkit handles **production observability**. No overlap.

| | skill-creator | skillkit |
|--|:---:|:---:|
| **Authoring** | | |
| Write SKILL.md from intent | yes | — |
| Bundle scripts/references/assets | yes | — |
| Optimize description for trigger accuracy | yes | — |
| **Evaluation** | | |
| Auto-generate evals from SKILL.md | yes | — |
| Run evals (with-skill vs baseline) | yes | — |
| Grade assertions (grader agent) | yes | — |
| Blind A/B comparison (comparator agent) | yes | — |
| Post-hoc analysis (analyzer agent) | yes | — |
| HTML eval viewer + feedback loop | yes | — |
| Description trigger optimization (train/test split) | yes | — |
| **Production observability** | | |
| Usage analytics across sessions | — | yes |
| Context budget monitoring | — | yes |
| Trigger conflict detection | — | yes |
| Dead weight analysis | — | yes |
| Cost/burn rate analysis | — | yes |
| Unused skill pruning | — | yes |
| Multi-agent skill discovery (15+ agents) | — | yes |

### Lifecycle

```bash
# 1. CREATE + TEST — use skill-creator (interactive, inside Claude)
#    /skill-creator "I want a skill that generates DB migrations"
#    → Interview, draft SKILL.md, run evals via subagents,
#      review in HTML viewer, iterate, optimize description

# 2. DEPLOY
npx skills add your-org/db-migrate

# 3. MONITOR — use skillkit (CLI, outside Claude)
skillkit scan && skillkit stats
skillkit coverage ./skills/db-migrate/   # find dead sections
skillkit conflicts                        # detect trigger collisions
skillkit burn                             # cost analysis

# 4. PRUNE — remove skills nobody uses
skillkit prune
```

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

### Burn

Analyzes API cost trends from session data.

```
$ skillkit burn
  Daily burn rate: $6.40/day
  Monthly projection: $192
  Runway: 31 days (plan: $200)

  Model breakdown:
    claude-sonnet-4-6   68%  $4.35/day
    claude-haiku-4-5    22%  $1.41/day
    claude-opus-4-6     10%  $0.64/day
```

### Conflicts

Detects trigger collisions between skills — when two skills might both fire for the same prompt.

```
$ skillkit conflicts
  Testing 15 skill pairs...

  ⚠ commit × deploy (HIGH)
    Both fire on "push these changes to production"

  ✓ 14 pairs clean
```

### Coverage

Finds dead weight in a skill — sections of SKILL.md and bundled files that never get referenced in sessions.

```
$ skillkit coverage ./skills/review/
  Sections: 8/12 referenced (67%)
  Files: 3/5 referenced (60%)

  Unreferenced sections:
    - ## Advanced Configuration
    - ## Troubleshooting
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
| `~/.skillkit/analytics.db` | SQLite database with invocation history and traces |
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
