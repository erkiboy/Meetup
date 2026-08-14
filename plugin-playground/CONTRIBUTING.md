# Contributing

## Development prerequisites

- Node.js 22+.
- Run `npm run check` to execute validation and tests.

## Adding a skill

1. Create a directory under `plugins/plugin-playground/skills/` with a unique
   kebab-case name.
2. Add a `SKILL.md` file whose YAML frontmatter `name` matches the directory
   name exactly.
3. Reference only local files; do not pull external dependencies.
4. Run `npm run check` to verify discovery and frontmatter.

## Adding an MCP template

1. Create a `.mcp.json` file under `plugins/plugin-playground/examples/mcp/`.
2. Pin every package to an exact version (e.g. `@scope/package@1.2.3`).
3. Use `${VARIABLE}` references for secrets; never inline credentials.
4. Review provenance, license, permissions, and data-access scope before
   submitting.

## Promoting an MCP template to active configuration

1. Move the reviewed config to `plugins/plugin-playground/.mcp.json`.
2. Add `"mcpServers": ".mcp.json"` to the plugin manifest.
3. Document all commands, packages, URLs, and environment variables.
4. Add positive (valid) and unsafe (invalid) test fixtures.
5. Run the local smoke test described in README.md.
6. Obtain maintainer approval before merging.

## MCP environment variables

| Variable | Purpose | When required | Default |
|---|---|---|---|
| `EXAMPLE_MCP_ROOT` | Absolute directory exposed by inert filesystem example | Required only when manually testing template | No default; set locally |

## Review checklist

- [ ] Behavior: skill or MCP server does what it claims.
- [ ] Provenance: upstream source is trusted and actively maintained.
- [ ] Least privilege: minimal permissions and tool surface.
- [ ] Data access: no unexpected file, network, or credential access.
- [ ] Exact versions: all packages pinned to exact semver.
- [ ] No inline secrets: all credentials use `${VARIABLE}` references.
- [ ] Tests: positive and negative fixtures pass.
- [ ] Docs: README, CONTRIBUTING, and CHANGELOG updated.

## Release process

1. Update version in `package.json` and `plugins/plugin-playground/plugin.json`.
2. Update version in `.github/plugin/marketplace.json`.
3. Add a dated section to `CHANGELOG.md`.
4. Run `npm run check`.
5. Commit, tag with the version, and push.

No automation creates tags, pushes, deploys, or publishes.
