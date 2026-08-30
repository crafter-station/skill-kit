---
name: core
version: 0.13.0
description: "Canonical skillkit workflow served by the installed CLI. Read before auditing skill packs or analyzing skill usage, context cost, conflicts, coverage, and token burn."
---

# skillkit core

Skillkit is a local-first observability and structural-audit CLI for AI agent skills. It reads local skill directories and agent session stores. It does not require an account or send telemetry.

## Choose the command

- Audit an uninstalled skill, subset, or repository: `skillkit audit <path>`
- See which installed skills are used: `skillkit stats`
- Inspect private usage receipts: `skillkit receipts --pending`
- Read receipts from another Mac in the tailnet: `skillkit receipts --remote user@mac.tailnet.ts.net --all --json`
- Check installed-skill and database health: `skillkit health`
- Measure always-loaded context and MCP schemas: `skillkit context --mcp`
- Compare context before and after installing a pack: `skillkit context --save-baseline <name>`, then `skillkit context --compare <name>`
- Measure observed dead weight for one skill: `skillkit coverage <skill-path>`
- Find overlapping triggers: `skillkit conflicts`
- Trace one invocation: `skillkit trace <prompt>`
- Inspect subscription token burn: `skillkit burn`
- Remove unused skills: run `skillkit prune` first, then add `--yes` only when deletion is intended

## Audit a skill pack

Use `audit` for static analysis that does not depend on installation or session history:

```bash
skillkit audit ./skills
skillkit audit ./skills/testing ./skills/release
skillkit audit ./skills --include "rn-*"
skillkit audit ./skills --json --strict
```

The report separates three context layers:

- Catalog cost: `name` and `description`, available during discovery
- Activation cost: the selected `SKILL.md`
- On-demand cost: files under `references/`

It checks metadata, estimated tokens, line count, bundled references, scripts and assets, broken or unsafe pointers, unreferenced files, explicit reference-routing instructions, duplicate names, and similar descriptions.

`--strict` exits with status 1 when warnings or errors are present. Token counts are local estimates based on character length, so treat them as consistent budget signals rather than provider-exact billing values.

## Usage and context workflow

On a new installation, scan before interpreting usage:

```bash
skillkit scan
skillkit stats --all --days 90
skillkit health
skillkit receipts --pending
skillkit receipts --remote user@mac.tailnet.ts.net --all --json
```

Before adding a large skill pack or MCP server:

```bash
skillkit context --save-baseline before
skillkit context --mcp
skillkit context --mcp --compare before
```

Use `coverage` only when observed traces matter. Use `audit` for filesystem structure and best-practice conformance.

## Automation

Add `--json` when the command supports machine-readable output. Use `audit --json --strict` in CI. Agent filters such as `--claude`, `--codex`, `--cursor`, `--gemini`, and `--opencode` narrow commands that read installed skills or sessions.

Remote receipt collection runs Skillkit beside the source sessions, requires an exact version match, and transfers only private receipt JSON. Do not copy raw remote transcripts or the remote Skillkit database. Do not treat unmeasured MCP servers as zero cost. Do not run `prune --yes` unless deletion is explicitly intended.

Read `references/commands.md` when exact flags, aliases, JSON behavior, data locations, or the full command catalog are needed. The same reference is included by `skillkit skills get core --full`.
