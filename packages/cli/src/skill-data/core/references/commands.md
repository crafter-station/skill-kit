# Skillkit command reference

## Bundled skills

```bash
skillkit skills list
skillkit skills get core
skillkit skills get core --full
```

`skills get core` returns the canonical workflow bundled with the installed CLI. `--full` appends this command reference.

## Structural audit

```bash
skillkit audit [path ...]
skillkit audit ./skills --include "rn-*"
skillkit audit ./skills --include "rn-*" --include "expo-*"
skillkit audit ./skills --json
skillkit audit ./skills --json --strict
```

With no path, `audit` searches the current directory recursively. Paths may be skill directories, `SKILL.md` files, pack directories, or multiple explicit skills. `--include` matches declared skill names, folder names, and paths relative to the supplied roots. Repeated include flags are combined.

The JSON response contains:

- `token_estimation`: estimation method and approximation marker
- `summary`: pack status, pass/warn/fail counts, catalog tokens, activation total/median/max, on-demand reference tokens, file totals, and finding count
- `overlaps`: duplicate names and similar descriptions
- `skills`: per-skill status, metrics, file inventory, and findings

Without `--strict`, structural findings are reported without failing the process. Input errors still exit 1. With `--strict`, any warning or error exits 1.

## Usage

```bash
skillkit scan
skillkit scan --full
skillkit scan --include-commands
skillkit stats
skillkit stats --all
skillkit stats --days 90
skillkit sessions
skillkit graph
```

`stats` auto-scans on first use. `scan --full` ignores the incremental cache. `graph` is also available as `contrib`.

## Installed-skill health and cleanup

```bash
skillkit list
skillkit health
skillkit health --json
skillkit prune
skillkit prune --skill <name>
skillkit prune --yes
```

`list` is also available as `ls`. `health` combines installed-skill usage, metadata budget, database state, and the same line/token measurements used by `audit`. `prune` is a dry run unless `--yes` is supplied.

## Context cost

```bash
skillkit context
skillkit context --mcp
skillkit context --mcp-timeout 30
skillkit context --save-baseline before
skillkit context --compare before
skillkit context --list-baselines
skillkit context --delete-baseline before
skillkit context --turns 40
skillkit context --sonnet
skillkit context --haiku
```

`context` is also available as `ctx`. It measures eager context from project instructions, memory, skill metadata, and optionally MCP tool schemas. Servers that fail, time out, or use an unsupported transport are reported as unmeasured.

## Deeper analysis

```bash
skillkit coverage <skill-path>
skillkit conflicts
skillkit trace <prompt>
skillkit trace --list
skillkit trace --show <id>
```

`coverage` combines skill structure with recorded traces. `conflicts` and `trace` require a supported authenticated model CLI for their execution path.

## Spend

```bash
skillkit burn
skillkit burn --days 30
skillkit burn --plan 200
```

Burn analysis uses local session usage. Pass explicit plan pricing in automation to avoid interactive configuration.

## Automatic scans

```bash
skillkit auto
```

This installs the supported session hook so usage scans happen after sessions.

## Agent filters

Commands that inspect installed skills or sessions accept agent filters including:

```bash
--claude --codex --cursor --gemini --opencode --windsurf
```

## Local data

- Analytics database: `~/.skillkit/analytics.db`
- Configuration: `~/.skillkit/config.json`
- Skill directories and agent session stores are read-only except for explicitly confirmed pruning or hook installation.
