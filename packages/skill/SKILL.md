---
name: skill-kit
description: "Skill analytics, health checks, and management for AI coding agents. Use when user asks about skill usage, stats, health, installed skills, or wants to install/uninstall/update skills."
---

# SkillKit

The package manager for AI agent skills. Tracks usage, runs health checks, and manages installed skills.

## Commands

Run these via the terminal:

- `skill-kit list` - List all installed skills with size and description
- `skill-kit stats` - Show usage analytics with sparklines (last 30 days)
- `skill-kit health` - Run a health check (unused skills, context budget, DB status)
- `skill-kit analyze` - Scan session files and populate the analytics database
- `skill-kit install <source>` - Install a skill from URL or registry
- `skill-kit uninstall <name>` - Remove a skill
- `skill-kit update` - Check for and apply skill updates

## When to Use

- User asks "which skills am I using the most?"
- User asks "are there any unused skills?"
- User wants to see skill analytics or usage trends
- User wants to check skill health or context budget
- User wants to install, uninstall, or update skills

## How It Works

SkillKit scans Claude Code session JSONL files at `~/.claude/projects/` to extract skill invocations. Data is stored in a local SQLite database at `~/.skill-kit/analytics.db`. No data leaves your machine.
