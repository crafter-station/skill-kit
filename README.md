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
| `skills` | Load guidance matched to the installed CLI version |
| `auto` | Auto-scan after Claude Code sessions |
| `stats` | Usage analytics with sparklines (auto-scans on first run) |
| `receipts` | Private, reviewable records grouped by skill, agent, and session |
| `list` | List installed skills with size and context budget |
| `health` | Health check: unused skills, context budget, DB |
| `audit` | Audit any skill or pack against Agent Skills best practices |
| `trace` | Run and record skill execution traces |
| `conflicts` | Test skills for trigger collisions |
| `coverage` | Analyze dead weight in a skill |
| `prune` | Remove unused skills to reclaim context budget |
| `context` | Context tax: tokens and cost loaded on every API call |
| `burn` | Token burn rate and cost across agents |
| `sessions` | Daily usage across all agents |
| `graph` | 52-week contribution heatmap |
| `scan` | Force re-scan (runs automatically, rarely needed) |

### Flags

| Flag | Applies to | Description |
|------|-----------|-------------|
| `--full` | skills | Include the complete bundled command reference |
| `--mcp` | context | Measure MCP server tool schemas (spawns each server) |
| `--mcp-timeout N` | context | Per-server probe timeout in seconds (default: 20) |
| `--compare <name>` | context | Diff against a saved baseline |
| `--save-baseline <name>` | context | Save the current measurement |
| `--days N` | stats | Time range in days (default: 30) |
| `--all` | stats | Show all skills, not just top 10 |
| `--include-commands` | scan | Also track slash commands |
| `--include <glob>` | audit | Audit only matching skills in a pack |
| `--strict` | audit | Exit 1 when warnings or errors are found |
| `--remote <host.ts.net>` | receipts | Scan and export receipts from a Mac over Tailscale SSH |
| `--claude` | any | Only scan Claude Code |
| `--opencode` | any | Only scan OpenCode |

When an MCP server does not answer within `--mcp-timeout`, it is skipped and
reported as timed out; the command does not hang waiting for it.

Install skills via [skills.sh](https://skills.sh): `bunx skills add <owner/repo>`

### Version-matched agent guidance

The installable `skillkit` skill is a thin discovery stub. It asks the agent to load the canonical workflow from the installed CLI, so guidance cannot silently drift from command behavior:

```bash
skillkit skills get core
skillkit skills get core --full
```

The first command returns the operating workflow. `--full` adds exact flags, JSON behavior, safety notes, data locations, and the complete command catalog. Both bundled skill files are checked against the CLI package version during release.

## Use as a Skill

Install skillkit as a skill so the agent can run analytics commands for you:

```bash
bunx skills add crafter-station/skill-kit --skill skillkit
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

### Audit

Audits one skill, multiple skill paths, or an entire repository without installing it. Reports eager metadata cost, activation cost, on-demand reference cost, bundled files, broken pointers, unreferenced files, progressive disclosure gaps, and possible description overlaps.

```bash
skillkit audit ./skills
skillkit audit ./skills/testing ./skills/release
skillkit audit ./skills --include "rn-*"
skillkit audit ./skills --json --strict
```

`--strict` is intended for CI. Token counts are local estimates based on character length.

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

All data stays on the machine that owns the sessions. Analytics live in that machine's `~/.skillkit/analytics.db`; every agent source below is read-only. `receipts --remote` runs Skillkit on a Tailscale MagicDNS host and transports only its private receipt JSON, never its raw session files or database.

## Supported Agents

Session connectors (skill invocations tracked from local session data):

| Agent | Format | Session source |
|-------|--------|----------------|
| Claude Code | JSONL | `~/.claude/projects/**/*.jsonl` |
| OpenCode | SQLite | `opencode.db` (XDG data dir) |
| Cursor | JSONL | `~/.cursor/projects/**/*.jsonl` |
| Codex | JSONL | `~/.codex/sessions/**/*.jsonl` |
| Gemini CLI | JSON | `~/.gemini/tmp/**/chats/session-*.json` |
| Amp | JSON | `$XDG_DATA_HOME/amp/threads/*.json` (legacy; modern Amp stores threads server-side) |
| Cline | JSON | VS Code `globalStorage/saoudrizwan.claude-dev/tasks` + `~/.cline/data/tasks` |
| Roo Code | JSON | VS Code `globalStorage/RooVeterinaryInc.roo-cline/tasks` |
| Kilo Code | SQLite + JSON | `kilo.db` (XDG data dir) + legacy globalStorage tasks |
| Continue | JSON | `~/.continue/sessions/*.json` |
| Goose | SQLite + JSONL | `sessions.db` (XDG data dir) + legacy `*.jsonl` |
| GitHub Copilot CLI | JSONL | `~/.copilot/session-state/*/events.jsonl` |
| OpenHands | JSON | `~/.openhands/{conversations,v1_conversations}` |
| Windsurf | SQLite | `state.vscdb` (Windsurf globalStorage) |

Filter any command by agent, e.g. `--claude`, `--opencode`, `--cursor`.

Not trackable yet: **Trae** (closed-source, no documented local conversation storage). Windsurf's native Cascade trajectories (`~/.codeium/windsurf/cascade/*.pb`) are encrypted at rest; the connector reads the VS Code state database instead.

Skill *discovery* (which skills are installed where) covers all 75 agents in the [skills.sh](https://skills.sh) ecosystem via a vendored registry (`agent-registry.generated.json`, re-synced with `bun run scripts/sync-agent-registry.ts`).

### Adding a connector

Each agent is an isometric adapter implementing the `Connector` interface (`packages/cli/src/scanner/connector.ts`): `count()`, `scan()`, plus a `parse*` function tested against fixtures faithful to the agent's real session schema. Register it in `packages/cli/src/scanner/registry.ts` - no other wiring needed.

## Project Structure

```
skill-kit/
├── apps/web/          # Landing page (Next.js)
├── packages/cli/      # CLI and bundled version-matched skill content
└── skills/skillkit/   # Thin installable discovery stub
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
