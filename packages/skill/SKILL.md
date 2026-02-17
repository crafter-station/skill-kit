---
name: skillkit
description: "Local-first analytics for AI agent skills. Use when user asks about skill usage, analytics, health, context budget, or wants to clean up unused skills."
---

# SkillKit

Analytics for AI agent skills. Tracks usage, measures context budget, and prunes what you don't use.

## Commands

Run via terminal (requires Bun):

- `skillkit scan` - Discover installed skills and index session data
- `skillkit list` - List installed skills with size and context budget
- `skillkit stats` - Show usage analytics with sparklines (last 30 days)
- `skillkit health` - Health check: unused skills, context budget, DB status
- `skillkit prune` - List unused skills. Add `--yes` to confirm deletion

## When to Use

- User asks "which skills do I use the most?"
- User asks "are there unused skills?" or "clean up my skills"
- User wants to see skill analytics, usage trends, or context budget
- User wants to optimize their skill setup
- User asks about context window usage from skills

## Decision Guide

1. First time? Run `skillkit scan` to discover and index everything
2. Want trends? Run `skillkit stats` for sparkline analytics
3. Want cleanup? Run `skillkit health` then `skillkit prune --yes`
4. Quick overview? Run `skillkit list` for installed skills with sizes

## How It Works

Scans `~/.claude/skills/` for installed skills and `~/.claude/projects/**/*.jsonl` for session files. Extracts `Skill` tool_use blocks and stores analytics in `~/.skillkit/analytics.db`. All data is local.
