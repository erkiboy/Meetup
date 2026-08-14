# Plugin Playground

Example skills and reviewed MCP configuration patterns for GitHub Copilot CLI.

> **Trust boundary** — review plugin source and MCP permissions before
> installation. The MCP example included in this repository is inert and
> starts no process.

## Prerequisites

- GitHub Copilot CLI with plugin support.
- Node.js 22+ (only required for running contribution checks).

## Local installation

```bash
copilot plugin marketplace add "$(pwd)"
copilot plugin install plugin-playground@plugin-playground
copilot plugin list
```

## Public installation

```bash
copilot plugin marketplace add at00216844/plugin-playground
copilot plugin install plugin-playground@plugin-playground
```

## Update

```bash
copilot plugin marketplace update plugin-playground
copilot plugin update plugin-playground
```

## Disable / enable

```bash
copilot plugin disable plugin-playground
copilot plugin enable plugin-playground
```

## Uninstall / remove

```bash
copilot plugin uninstall plugin-playground
copilot plugin marketplace remove plugin-playground
```

## Local smoke test

```bash
copilot plugin marketplace add "$(pwd)"
copilot plugin marketplace browse plugin-playground
copilot plugin install plugin-playground@plugin-playground
copilot plugin list
copilot mcp list
copilot
```

Inside interactive Copilot run `/skills list`, confirm `example-skill`,
invoke it, and confirm the exact response
`plugin-playground example skill is available`. Confirm
`example-filesystem` is absent from `copilot mcp list`.

Cleanup:

```bash
copilot plugin uninstall plugin-playground
copilot plugin marketplace remove plugin-playground
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Invalid marketplace registration | Use repository root or `at00216844/plugin-playground`; verify `.github/plugin/marketplace.json`. |
| Stale cache | `copilot plugin marketplace update plugin-playground`; reinstall local plugin because installs are cached. |
| Version mismatch | Synchronize both `0.1.0` values and run `npm run check`. |
| Missing runtime command | Install the command named by the activated MCP config and verify `PATH`. |
| Missing environment variable | Export the documented variable without committing its value. |
| Existing installed plugin blocks marketplace removal | Uninstall the plugin first; do not use `--force` as a normal path. |

## MCP environment variables

| Variable | Purpose | When required | Default |
|---|---|---|---|
| `EXAMPLE_MCP_ROOT` | Absolute directory exposed by inert filesystem example | Required only when manually testing template | No default; set locally |

## CI

Every pull request and push is validated by `.github/workflows/validate.yml` on
Node.js 22 and 24 via `npm run check`. The workflow uses read-only permissions
(`contents: read`) and performs no deploys, releases, or authenticated
Copilot calls.
