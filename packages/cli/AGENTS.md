# @crafter/skillkit — agent guide

skillkit is a local-first observability CLI for AI agent skills: it discovers skills installed for 15+ coding agents (Claude Code, Cursor, Codex, Gemini CLI, OpenCode, and more), indexes session files, and reports usage analytics, context-budget cost, trigger conflicts, dead weight, and subscription burn rate. Everything runs locally against `~/.skillkit/analytics.db`; no telemetry, no signup. An agent should reach for skillkit when the user asks which skills they actually use, what their skills cost in context tokens or dollars, whether skills collide on the same triggers, or which skills to prune.

## Install

Requires [Bun](https://bun.sh) as the runtime (native SQLite, TypeScript execution). The published bin runs with `#!/usr/bin/env bun`, so `npm i -g` works only if Bun is installed.

```bash
# no install
bunx @crafter/skillkit scan

# global
bun add -g @crafter/skillkit
skillkit scan
```

## Commands

| Command | Description |
|---------|-------------|
| `skillkit scan` | Discover installed skills and index session data (run this first) |
| `skillkit list` (alias `ls`) | List installed skills with size and context budget |
| `skillkit stats` | Usage analytics with sparklines (last 30 days) |
| `skillkit health` | Health check: unused skills, context budget, DB |
| `skillkit trace <prompt>` | Run and record a skill execution trace (spawns `claude -p`) |
| `skillkit conflicts` | Test skills for trigger collisions |
| `skillkit coverage <skill-path>` | Analyze dead weight in a skill |
| `skillkit prune` | Remove unused skills to reclaim context budget |
| `skillkit burn` | Subscription burn rate analysis (cost, models, daily) |
| `skillkit context` (alias `ctx`) | Context tax: tokens + cost loaded every API call |
| `skillkit sessions` | Daily usage across all agents |
| `skillkit graph` (alias `contrib`) | 52-week contribution heatmap |
| `skillkit auto` | Auto-scan after Claude Code sessions |
| `skillkit version` | Print version |

### Flags (from `skillkit help`)

- `scan --include-commands` (also track slash commands), `scan --full` (re-index every session, ignore incremental cache)
- `stats --days N` (default 30), `stats --all` (all skills, not just top 10), `stats --json`
- `health --json`
- `trace --list`, `trace --list --json`, `trace --show <id>`, `trace --model <model>`
- `prune --skill <name>`, `prune --yes --json`
- `burn --days N` (default 30), `burn --plan N` (monthly plan USD, default 200), `burn --json`
- `context --sonnet/--haiku` (pricing model, default opus), `context --turns N` (default 40), `context --mcp`, `context --mcp-timeout N` (default 20), `context --save-baseline <n>`, `context --compare <n>`, `context --list-baselines`, `context --json`
- Any command: `--claude`, `--cursor`, `--codex`, `--gemini`, `--opencode` to scan a single agent

## Usage patterns

1. First run — index, then inspect:
   ```bash
   bunx @crafter/skillkit scan
   bunx @crafter/skillkit stats --json
   bunx @crafter/skillkit health --json
   ```
2. Find and remove unused skills:
   ```bash
   bunx @crafter/skillkit prune            # dry run, lists reclaimable skills
   bunx @crafter/skillkit prune --yes --json   # actually delete
   ```
3. Measure what skills cost per API call and diff after changes:
   ```bash
   bunx @crafter/skillkit context --json
   bunx @crafter/skillkit context --save-baseline before
   # ...edit skills...
   bunx @crafter/skillkit context --compare before
   ```
4. Audit a single skill for dead weight and collisions:
   ```bash
   bunx @crafter/skillkit coverage ~/.claude/skills/my-skill/
   bunx @crafter/skillkit conflicts
   ```

## Task -> command

| Task | Command |
|------|---------|
| "Which skills do I actually use?" | `skillkit scan && skillkit stats` |
| "What are my skills costing me in context?" | `skillkit context --json` |
| "How much am I spending on Claude/Cursor?" | `skillkit burn --json` |
| "Do any skills fire on the same prompts?" | `skillkit conflicts` |
| "Is this skill bloated?" | `skillkit coverage <path>` |
| "Clean up unused skills" | `skillkit prune --yes` |
| "Did skill X trigger for prompt Y?" | `skillkit trace "<prompt>"` |
| Machine-readable output for any of the above | add `--json` |

## Common mistakes

- Wrong: `npm i skillkit` / Correct: `npm i @crafter/skillkit` (unscoped `skillkit` is a different/nonexistent package)
- Wrong: `npx skillkit stats` / Correct: `bunx @crafter/skillkit stats`
- Wrong: running `stats`/`health`/`graph` on a fresh install and expecting data / Correct: run `skillkit scan` first; it builds `~/.skillkit/analytics.db`
- Wrong: assuming Node alone is enough / Correct: Bun >= 1.0 must be installed; the bin's shebang is `#!/usr/bin/env bun`
- Wrong: expecting `prune` to delete by default / Correct: `prune` is a dry run; pass `--yes` to delete, `--skill <name>` for one skill
- Wrong: running `trace` or `conflicts` without Claude Code / Correct: both spawn the `claude` CLI, which must be installed and authenticated
- Note: `burn` in an interactive TTY prompts to configure plan pricing on first run (saved to `~/.skillkit/config.json`); in scripts pass `--plan N --json` to skip the prompt

## Library exports

The package also exports a programmatic API (Bun runtime) from `@crafter/skillkit`: `runScan`, `runStats`, `runHealth`, `runList`, `runPrune`, `runTrace`, `scanAllSessions`, `scanInstalledSkills`, `getDetectedAgents`, `parseSessionFile` (plus Cursor/Codex/Gemini variants), DB helpers (`getDb`, `getSkillStats`, `getTopSkills`, `getInstalledSkills`, `getDailyUsage`, `recordInvocation`, `upsertInstalledSkill`), conflicts (`discoverAllSkills`, `findOverlappingPairs`, `generateProbes`, `analyzeCollision`, `summarizeConflicts`), coverage (`parseSkillDirectory`, `analyzeCoverage`), and trace store/report helpers, with their TypeScript types.

## Data locations

- `~/.skillkit/analytics.db` — SQLite database (invocations, traces, conflicts)
- `~/.claude/skills/` and per-agent skill dirs — read-only skill discovery
- `~/.claude/projects/**/*.jsonl` — read-only session parsing

Docs: https://skillkit.crafter.run
