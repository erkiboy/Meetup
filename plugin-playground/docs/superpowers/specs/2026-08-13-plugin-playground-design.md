# Plugin Playground Design

## Purpose

`plugin-playground` is a public GitHub Copilot CLI plugin marketplace for sharing
version-controlled skills and MCP server configurations with a team.

MVP provides:

- One installable plugin named `plugin-playground`
- One example skill
- One inert MCP configuration template
- Dependency-free validation and tests
- Contributor, security, installation, update, and troubleshooting guidance

## Architecture

Repository is both marketplace and plugin source:

```text
plugin-playground/
├── .github/
│   ├── plugin/
│   │   └── marketplace.json
│   └── workflows/
│       └── validate.yml
├── docs/
│   └── superpowers/specs/
├── plugins/
│   └── plugin-playground/
│       ├── plugin.json
│       ├── skills/
│       │   └── example-skill/
│       │       └── SKILL.md
│       └── examples/
│           └── mcp/
│               └── .mcp.json
├── scripts/
│   └── validate.mjs
├── test/
│   └── fixtures/
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── SECURITY.md
└── package.json
```

`.github/plugin/marketplace.json` publishes plugin source at
`plugins/plugin-playground/`. Plugin-root `plugin.json` uses current GitHub
Copilot CLI manifest format and declares `skills/`.

Approved MCP servers are added to plugin-root `.mcp.json` and referenced through
`mcpServers` in `plugin.json`. Initial MCP example remains under `examples/`, so
Copilot does not auto-discover or start it.

System has no custom runtime, database, bundled MCP server, or deployment
automation.

## Components

### Marketplace manifest

Defines marketplace identity, ownership, plugin source, version, description,
license, and repository metadata. Marketplace and plugin versions must match.

### Plugin manifest

Defines kebab-case plugin identity, semantic version, metadata, and skills path.
It declares an MCP configuration path only after at least one MCP server is
approved for activation. Manifest uses strict validation.

### Skills

Each skill is isolated under `skills/<skill-name>/SKILL.md`. Skill name must be
unique, kebab-case, and match its directory. Frontmatter must include name and
description. Supporting files remain inside skill directory.

Example skill demonstrates structure and invocation without requiring external
services.

### MCP configurations

MCP entries reference external packages, commands, or endpoints. Repository
never stores credentials. Secrets are supplied through documented environment
variables.

Initial template is inert. Promoting an MCP server requires moving configuration
into plugin-root `.mcp.json`, declaring it in `plugin.json`, documenting
prerequisites, and passing policy validation.

### Validation

`scripts/validate.mjs` uses Node standard library only. It validates:

- Marketplace and plugin JSON syntax and required fields
- Matching marketplace entry, source path, plugin name, and version
- Unique kebab-case skill and MCP names
- Skill directory and frontmatter invariants
- MCP configuration shape and supported transports
- Explicit versions for external package commands
- Absence of inline credentials and secret-like values
- Documentation for every MCP environment variable
- Required repository files

Errors include file, rule, and remediation.

### Tests and CI

`node:test` exercises valid and invalid fixtures for every validation rule.
GitHub Actions runs validation and tests on pull requests and pushes using
supported Node LTS versions.

Local Copilot smoke test verifies marketplace registration, plugin installation,
and example skill discovery. CI does not require Copilot authentication.

## Data Flow

### Installation

1. User registers public repository with `copilot plugin marketplace add`.
2. Copilot reads `.github/plugin/marketplace.json`.
3. User installs `plugin-playground@plugin-playground`.
4. Copilot resolves `plugins/plugin-playground/plugin.json`.
5. Copilot loads example skill. No MCP process starts in MVP.

### Update

1. Maintainer merges validated changes and creates semantic Git tag.
2. User refreshes marketplace or runs plugin update.
3. Copilot replaces cached plugin content with declared version.

### Contribution

1. Contributor creates branch.
2. Contributor adds isolated skill or MCP definition and documentation.
3. Local validation and tests run.
4. Pull request CI enforces repository contracts.
5. Maintainer reviews behavior, provenance, permissions, and MCP trust boundary.
6. Merge makes content eligible for next tagged release.

## Error Handling

Validation fails closed for malformed manifests, duplicate identifiers, invalid
frontmatter, unsupported MCP transports, unpinned packages, inline secrets,
undocumented environment variables, or inconsistent versions.

Runtime MCP failures surface directly through Copilot CLI. Plugin adds no broad
catch, silent fallback, or success-shaped error handling.

Installation and troubleshooting documentation covers invalid marketplace
registration, stale marketplace cache, plugin version mismatch, missing runtime
commands, and missing environment variables.

## Security

- No credentials, tokens, or secret defaults in repository
- External package versions pinned; no `latest`
- MCP commands and package provenance reviewed before activation
- MCP sample inert until explicitly promoted
- Environment variables documented without values
- `SECURITY.md` provides private vulnerability reporting path
- Contributors instructed to inspect third-party MCP permissions and data access
- No deployment or release automation with privileged credentials

## Release Process

Release is manual and auditable:

1. Update plugin and marketplace versions together.
2. Update `CHANGELOG.md`.
3. Run validation, tests, and local Copilot smoke test.
4. Commit release changes.
5. Create semantic Git tag.
6. Push branch and tag after human approval.

No deployment executes as part of repository validation.

## Acceptance Criteria

- Fresh GitHub Copilot CLI registers local or public marketplace.
- Copilot installs `plugin-playground@plugin-playground`.
- Installed plugin exposes example skill.
- Initial install starts no MCP process.
- Validator accepts repository baseline.
- Tests prove unsafe MCP fixtures are rejected.
- Contributor documentation covers adding, validating, and promoting skills and
  MCP definitions.
- Installation documentation covers install, update, disable, uninstall, and
  troubleshooting workflows.

## Out of Scope

- Browser UI
- Interactive scaffolding CLI
- Bundled MCP server implementations
- Secret storage
- Hosted registry or backend
- Automatic publishing, deployment, or release tagging
- VS Code-specific extension packaging
