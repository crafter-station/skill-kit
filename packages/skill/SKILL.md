---
name: skillkit
version: 0.11.0
description: "Local-first analytics for AI agent skills. Use when user asks about skill usage, analytics, health, context budget, MCP context cost, token burn rate, or wants to clean up unused skills."
---

# SkillKit

Analytics for AI agent skills. Tracks usage, measures what your context window costs, and prunes what you don't use. All data stays on the machine in `~/.skillkit/analytics.db`.

## Commands

Run with `npx @crafter/skillkit <command>`, or install globally (`npm i -g @crafter/skillkit`) and drop the prefix.

### Usage

- `stats` - Top skills with sparklines, streaks, weekly velocity (auto-scans on first run)
- `stats --all` - Every skill, not just the top 10
- `stats --days N` - Change the time range (default: 30)
- `sessions` - Daily usage and cost across all agents
- `graph` - 52-week contribution heatmap (alias: `contrib`)

### Context cost

- `context` - Tokens and cost loaded on every API call: CLAUDE.md and its imports, skill metadata, memory (alias: `ctx`)
- `context --mcp` - Also measure MCP server tool schemas. Often the largest slice, and invisible without this flag. Spawns each configured server to read its tool list, so it takes a few seconds
- `context --save-baseline <name>` - Save the current measurement
- `context --compare <name>` - Diff against a saved baseline to see what grew and why
- `context --list-baselines` / `context --delete-baseline <name>`
- `context --sonnet` / `context --haiku` - Price against another model (default: opus)
- `context --turns N` - Turns per session for the cost estimate (default: 40)

### Spend

- `burn` - Token burn rate, per-model breakdown, plan utilization
- `burn --days N` - Time range (default: 30)
- `burn --plan N` - Monthly plan cost in USD for the utilization figure

### Maintenance

- `health` - Unused skills, metadata budget, database status
- `list` - Installed skills with size and context budget (alias: `ls`)
- `prune` - List unused skills. Add `--yes` to actually delete
- `scan` - Force a re-scan. Runs automatically, rarely needed by hand
- `scan --full` - Ignore the incremental cache and re-read every session
- `scan --include-commands` - Also track slash commands, not just skills
- `auto` - Install the session hook so scans happen on their own

### Deeper analysis

- `trace` - Trace how a skill gets invoked
- `conflicts` - Find skills whose descriptions overlap enough to misfire
- `coverage` - Which installed skills actually see use

Add `--json` to most commands for machine-readable output. Filter by agent with `--claude`, `--codex`, `--cursor`, `--opencode`, `--gemini`, and the like.

## When to use

- "Which skills do I actually use?" or "are there unused skills?"
- "What is my context window costing me?" or "why is my context so big?"
- "How much am I spending on tokens?" or questions about burn rate and plan utilization
- "Did installing that pack blow up my context?" - baseline first, compare later
- Before and after adding MCP servers or skill packs, to see the real cost
- Cleaning up or optimizing an agent setup

## Decision guide

1. First time: `stats`. It discovers and indexes everything on its own.
2. Context feels bloated: `context --mcp`. MCP tool schemas are usually the biggest and least visible slice.
3. About to install a pack or server: `context --save-baseline before`, then `context --mcp --compare before` afterwards.
4. Cleanup: `health`, then `prune --yes`.
5. Cost questions: `burn --days 30`.
6. Full picture: `stats --all --days 90`.

## How it works

Indexes sessions from 14 agents, including Claude Code, Codex, Cursor, OpenCode, Windsurf, Cline, Roo, Kilocode, Continue, Goose, Copilot CLI, Gemini CLI, Amp, and OpenHands. Reads each agent's own session store (JSONL files, SQLite databases, VS Code workspace state) and extracts skill invocations.

Invocations are deduplicated by a stable per-event id from the source (tool-call id, event id) where one exists, falling back to a timestamp key for sources that provide none. That keeps a re-scan from double-counting an event seen through two stores with different timestamps.

`context` measures the eager cost, meaning what the model pays before you type anything. Token counts are approximated from character length, so treat them as an order of magnitude rather than an exact count. Servers that fail to start, time out, or use a transport that cannot be probed offline are reported as unmeasured, never as zero.
