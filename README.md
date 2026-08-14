# Meetup

## plugin-playground

This repository includes [`plugin-playground`](./plugin-playground), an example
**GitHub Copilot CLI plugin** demonstrating how to package version-controlled
skills and reviewed MCP (Model Context Protocol) server configurations for
distribution via a Copilot plugin marketplace.

**What it contains:**
- `plugins/plugin-playground/` — the plugin itself: a manifest (`plugin.json`), an
  example skill (`skills/example-skill`) that returns a fixed confirmation
  string, and an inert MCP filesystem example (`examples/mcp/.mcp.json`) that
  starts no process and requires no secrets.
- `.github/plugin/marketplace.json` — marketplace registration so the plugin
  can be installed locally or from `owner/repo`.
- `scripts/validate.mjs` + `scripts/validation/` — Node-based checks that
  verify manifest shape, MCP configuration safety (no inline secrets,
  documented env vars, pinned package versions), and required documentation
  files.
- `test/` — automated tests (`node --test`) covering the validation logic,
  including fixtures for malformed/invalid configurations.
- `.github/workflows/validate.yml` — CI that runs `npm run check` on every
  push/PR with read-only permissions.

**Try it locally:**
```bash
cd plugin-playground
npm run check                       # validate + test
copilot plugin marketplace add "$(pwd)"
copilot plugin install plugin-playground@plugin-playground
copilot plugin list
```

See [`plugin-playground/README.md`](./plugin-playground/README.md) for full
installation, update, and troubleshooting instructions.
