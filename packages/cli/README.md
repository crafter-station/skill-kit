# skillkit

Local-first observability for AI agent skills. Track usage, measure cost, detect conflicts, and prune what you don't use.

## Why

AI coding agents load skills into their context window on every session. More skills = less room for your actual code. But which skills do you actually use? Are they helping? How much do they cost?

**skillkit** answers these questions with usage analytics, conflict detection, cost analysis, and context budget monitoring — all locally on your machine.

## Prerequisites

skillkit requires [Bun](https://bun.sh) as its runtime (for native SQLite and fast TypeScript execution).

```bash
curl -fsSL https://bun.sh/install | bash
```

## Quick start

```bash
bunx @crafter/skillkit scan
bunx @crafter/skillkit stats
bunx @crafter/skillkit health
```

Or install globally:

```bash
bun add -g @crafter/skillkit
skillkit scan
```

> **Note:** `npm i -g` also works if bun is installed, since the bin entry uses bun as its runtime.

## Commands

| Command | Description |
|---------|-------------|
| `skillkit skills get core [--full]` | Load guidance matched to this CLI version |
| `skillkit scan` | Discover installed skills and index session data |
| `skillkit snapshot` | Refresh the local Agentfiles analytics snapshot |
| `skillkit list` | List installed skills with size and context budget |
| `skillkit stats` | Usage analytics with sparklines (last 30 days) |
| `skillkit receipts` | Private, reviewable receipts grouped by skill, agent, and session |
| `skillkit health` | Health check: unused skills, context budget, DB |
| `skillkit audit [path ...]` | Audit a skill or pack against Agent Skills best practices |
| `skillkit prune` | Remove unused skills to reclaim context budget |
| `skillkit burn` | Subscription burn rate analysis (cost, models, daily) |
| `skillkit conflicts` | Test skills for trigger collisions |
| `skillkit coverage <skill-path>` | Analyze dead weight in a skill |
| `skillkit trace <prompt>` | Run and record a skill execution trace |

Install skills via [skills.sh](https://skills.sh): `bunx skills add <owner/repo>`

## Programmatic Agentfiles API

The `@crafter/skillkit/agentfiles` export is compatible with Node and Electron. It contains no Bun SQLite imports and can be used without spawning the CLI.

```ts
import { loadAgentfilesSnapshot } from "@crafter/skillkit/agentfiles";

const snapshot = loadAgentfilesSnapshot();
```

`skillkit scan` and `skillkit snapshot` write the versioned local file at `~/.skillkit/agentfiles-snapshot.json`. Consumers should use the exported loader and types instead of reading or parsing the file directly.

### Version-matched guidance

```bash
skillkit skills list
skillkit skills get core
skillkit skills get core --full
```

`core` is bundled with the CLI. The default output is the compact operating workflow. `--full` appends exact flags, JSON behavior, safety notes, data locations, and the complete command reference. Release validation keeps the bundled skill and installable discovery stub at the same version as the CLI.

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
| Private usage receipts with honest unknown outcomes | no | yes |
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
bunx skills add your-org/db-migrate

# 3. MONITOR — use skillkit (CLI, outside Claude)
skillkit scan && skillkit stats
skillkit receipts --json
skillkit audit ./skills --strict          # enforce structural health
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

### Receipts

Every scan also creates idempotent private receipts grouped by skill, agent, and session. Historical procedure digests are marked `observed-after-session` or `unknown`, never exact by inference. Outcomes remain `unknown` until reviewed evidence annotates them.

```bash
skillkit receipts --pending
skillkit receipts --json
skillkit receipts --json --limit 100 --after <receipt-id>
skillkit receipts --all --json
skillkit receipts --annotate /private/path/annotations.json
skillkit receipts --remote user@mac.tailnet.ts.net --all --json
```

Receipt exports include local metadata and stay private by default. Counts are telemetry, not proof that a skill succeeded or deserves promotion.

Remote receipt collection accepts only Tailscale MagicDNS `*.ts.net` targets. It checks that the remote Skillkit version exactly matches the local CLI, runs the scan beside the source sessions, and returns private receipt JSON over non-interactive SSH. Raw transcripts and the remote SQLite database remain on the source Mac. Remote annotation is intentionally unsupported.

### Health

Checks metadata budget usage (name + description loaded at startup) and flags unused skills.

```
$ skillkit health
  [████████░░] 78% metadata budget (12.5K / 16.0K)
  ! 3 skills unused in 30d — run skillkit prune
```

### Audit

Audits arbitrary local skill paths without requiring installation or analytics history.

```bash
skillkit audit ./skills
skillkit audit ./skills/testing ./skills/release
skillkit audit ./skills --include "rn-*"
skillkit audit ./skills --json --strict
```

The report separates catalog cost from one-skill activation cost and on-demand reference cost. It also checks the 500-line and estimated 5,000-token recommendations, metadata, missing and unreferenced files, explicit reference routing, and overlapping descriptions. `--strict` exits with status 1 on any finding.

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
