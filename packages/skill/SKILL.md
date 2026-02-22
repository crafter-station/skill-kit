---
name: skillkit
description: "Local-first analytics for AI agent skills. Use when user asks about skill usage, analytics, health, context budget, or wants to clean up unused skills."
---

# SkillKit

Analytics for AI agent skills. Tracks usage, measures context budget, and prunes what you don't use.

## Commands

SkillKit is an npm CLI. Run commands with `npx @crafter/skillkit <command>` or install globally first (`npm i -g @crafter/skillkit`).

- `npx @crafter/skillkit stats` - Usage analytics with sparklines (auto-scans on first run)
- `npx @crafter/skillkit stats --all` - Show all skills, not just top 10
- `npx @crafter/skillkit stats --days N` - Change time range (default: 30)
- `npx @crafter/skillkit stats --all --days 90` - Full list over 90 days
- `npx @crafter/skillkit list` - List installed skills with size and context budget
- `npx @crafter/skillkit health` - Health check: unused skills, context budget, DB status
- `npx @crafter/skillkit prune` - List unused skills. Add `--yes` to confirm deletion
- `npx @crafter/skillkit scan` - Force re-scan (runs automatically, rarely needed)
- `npx @crafter/skillkit scan --include-commands` - Also track slash commands
- Any command with `--claude` or `--opencode` to filter by agent

## When to Use

- User asks "which skills do I use the most?"
- User asks "are there unused skills?" or "clean up my skills"
- User wants to see skill analytics, usage trends, or context budget
- User wants to optimize their skill setup
- User asks about context window usage from skills
- User asks "show me all my skill usage" or "full stats"

## Decision Guide

1. First time? Run `npx @crafter/skillkit stats` - it auto-discovers and indexes everything
2. Full picture? Run `npx @crafter/skillkit stats --all --days 90`
3. Want cleanup? Run `npx @crafter/skillkit health` then `npx @crafter/skillkit prune --yes`
4. Quick overview? Run `npx @crafter/skillkit list` for installed skills with sizes
5. Filter by agent? Add `--claude` or `--opencode` to any command

## How It Works

Discovers skills for Claude Code and OpenCode. Scans skill directories and project-local `.claude/skills/` for installed skills. Indexes Claude Code JSONL sessions and OpenCode SQLite sessions. Extracts `Skill` tool_use blocks from assistant messages and `<command-name>` tags from user messages. Auto-deduplicates on every scan. All data stored locally in `~/.skillkit/analytics.db`.
