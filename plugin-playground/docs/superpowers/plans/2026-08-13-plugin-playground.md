# Plugin Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public GitHub Copilot CLI plugin marketplace containing one installable, skills-only plugin, one inert MCP template, dependency-free validation/tests, CI, and complete maintainer/user documentation.

**Architecture:** Repository is both marketplace catalog and plugin source. A dependency-free Node.js validator exposes composable rule functions plus a CLI entry point; `node:test` runs rules against a canonical valid fixture and focused invalid fixture overlays. MVP plugin declares only `skills/`, while MCP configuration remains below `examples/` and therefore cannot be auto-discovered or started.

**Tech Stack:** Node.js 22 and 24 LTS, ECMAScript modules, Node standard library (`node:fs/promises`, `node:path`, `node:url`, `node:test`, `node:assert`), JSON, Markdown, GitHub Actions.

## Global Constraints

- One marketplace named `plugin-playground` publishes one plugin named `plugin-playground`.
- Marketplace and plugin versions start at `0.1.0` and must always match.
- Plugin names, skill names, and MCP server names use lowercase kebab-case matching `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`.
- Plugin manifest uses strict GitHub Copilot CLI validation and declares `skills/`; MVP does not declare `mcpServers`.
- Initial MCP sample stays at `plugins/plugin-playground/examples/mcp/.mcp.json`; no plugin-root `.mcp.json` exists in MVP.
- Node implementation has zero runtime and development dependencies.
- Supported MCP transports are `local`, `stdio`, `http`, and `sse`; `sse` remains supported only for compatibility.
- External package invocations must pin an exact package version; tags and ranges such as `latest`, `next`, `^1.2.3`, and `~1.2.3` fail validation.
- Repository stores no credentials, tokens, secret defaults, bundled MCP server, runtime service, database, deployment workflow, release automation, or automatic tag creation.
- Validation errors always include file, stable rule code, actionable message, and remediation.
- CI runs validation and tests on pull requests and pushes with Node.js 22 and 24; CI never requires Copilot authentication.
- Releases remain manual: synchronized versions, changelog, local validation/tests/smoke test, human-approved commit, tag, and push.
- Do not add browser UI, interactive scaffolding CLI, hosted registry/backend, VS Code packaging, deployment, or automatic publishing.

---

## File Map

### Repository and plugin content

| Path | Action | Responsibility |
|---|---|---|
| `.github/plugin/marketplace.json` | Create | Marketplace identity, owner, metadata, and single local plugin source. |
| `plugins/plugin-playground/plugin.json` | Create | Strict plugin metadata and `skills/` component path; deliberately omits `mcpServers`. |
| `plugins/plugin-playground/skills/example-skill/SKILL.md` | Create | Dependency-free example skill with matching kebab-case frontmatter. |
| `plugins/plugin-playground/examples/mcp/.mcp.json` | Create | Inert, version-pinned stdio MCP template using environment-variable expansion only. |
| `package.json` | Create | Private ESM package, Node floor, validation and test scripts, no dependencies. |
| `LICENSE` | Create | MIT license text, copyright year 2026. |

### Validator

| Path | Action | Responsibility |
|---|---|---|
| `scripts/validate.mjs` | Create | CLI adapter: resolve repository root, invoke validation, print deterministic diagnostics, set exit code. |
| `scripts/validation/constants.mjs` | Create | Regexes, required paths, supported transports, secret-key/value patterns. |
| `scripts/validation/diagnostic.mjs` | Create | `Diagnostic` shape, diagnostic factory, deterministic formatting/sorting. |
| `scripts/validation/fs.mjs` | Create | Safe UTF-8 reads, JSON parsing, recursive file discovery, path normalization. |
| `scripts/validation/frontmatter.mjs` | Create | Minimal strict parser for `name` and `description` scalar frontmatter. |
| `scripts/validation/manifests.mjs` | Create | Marketplace/plugin schema, identity, source, strict mode, and version rules. |
| `scripts/validation/skills.mjs` | Create | Skill discovery, uniqueness, directory/name, and frontmatter rules. |
| `scripts/validation/mcp.mjs` | Create | MCP shape, transport, naming, package pin, secret, and environment-variable rules. |
| `scripts/validation/documentation.mjs` | Create | Required repository files and MCP environment-variable documentation rules. |
| `scripts/validation/repository.mjs` | Create | Orchestrator and public validator API. |

### Tests and fixtures

| Path | Action | Responsibility |
|---|---|---|
| `test/helpers/fixture.mjs` | Create | Copy valid fixture, apply invalid overlays and `.delete` markers, clean temporary directory. |
| `test/diagnostic.test.mjs` | Create | Diagnostic creation, sorting, formatting, and CLI output contract. |
| `test/frontmatter.test.mjs` | Create | Strict parser unit tests. |
| `test/validate.test.mjs` | Create | Valid baseline plus one test for every validation rule and CLI exit behavior. |
| `test/fixtures/valid/**` | Create | Minimal complete valid repository mirroring production structure. |
| `test/fixtures/invalid/**` | Create | Focused overlays listed in Fixture Matrix below. |

### Documentation and automation

| Path | Action | Responsibility |
|---|---|---|
| `.github/workflows/validate.yml` | Create | Node 22/24 matrix running validation and tests on push/PR. |
| `README.md` | Create | Purpose, trust model, installation, update, disable, uninstall, smoke test, troubleshooting. |
| `CONTRIBUTING.md` | Create | Skill/MCP contribution workflow, review gates, validation, manual release process. |
| `SECURITY.md` | Create | Private vulnerability reporting and credential-incident guidance. |
| `CHANGELOG.md` | Create | Keep a Changelog structure and `0.1.0` MVP entry. |

## Public Interfaces

All validator modules use JSDoc types so Node performs dependency-free execution while editors retain type information.

```js
// scripts/validation/diagnostic.mjs
/**
 * @typedef {object} Diagnostic
 * @property {string} file Repository-relative POSIX path.
 * @property {string} rule Stable uppercase rule identifier.
 * @property {string} message Failure description.
 * @property {string} remediation Exact corrective action.
 */
export function diagnostic(file, rule, message, remediation) {}
export function sortDiagnostics(diagnostics) {}
export function formatDiagnostic(value) {}
```

```js
// scripts/validation/fs.mjs
export async function pathExists(absolutePath) {}
export async function readText(root, relativePath) {}
export async function readJson(root, relativePath) {}
export async function findFiles(root, relativeDirectory, basename) {}
export function toPosixPath(value) {}
```

`readJson()` returns `{ value, diagnostics }`, never throws for missing/malformed user content, and emits `JSON_PARSE`; unexpected I/O errors still reject.

```js
// scripts/validation/frontmatter.mjs
/**
 * @returns {{ attributes: Record<string, string>, body: string, diagnostics: Diagnostic[] }}
 */
export function parseSkillDocument(file, source) {}
```

```js
// rule modules
export async function validateManifests(root) {}
export async function validateSkills(root, plugin) {}
export async function validateMcpConfigurations(root, plugin) {}
export async function validateDocumentation(root, mcpEnvironmentVariables) {}
```

Each rule module returns `{ diagnostics, ...context }`. `validateManifests()` also returns parsed `marketplace` and `plugin`; `validateMcpConfigurations()` also returns sorted unique `environmentVariables`.

```js
// scripts/validation/repository.mjs
/**
 * @typedef {object} ValidationResult
 * @property {Diagnostic[]} diagnostics
 * @property {number} checkedFiles
 * @property {string[]} mcpEnvironmentVariables
 */
export async function validateRepository(root) {}
```

CLI contract:

```text
$ node scripts/validate.mjs
Validation passed (N files checked).

$ node scripts/validate.mjs test/fixtures/invalid/inline-secret
plugins/plugin-playground/examples/mcp/.mcp.json [MCP_INLINE_SECRET] ...
  Remediation: ...
Validation failed with 1 error.
```

Exit code is `0` on no diagnostics and `1` on validation diagnostics. Unexpected process failures print `Validation crashed: <message>` to stderr and set exit code `2`.

## Stable Rule Catalog

| Rule | Trigger |
|---|---|
| `REQUIRED_FILE` | Required repository file absent or not a regular file. |
| `JSON_PARSE` | JSON unreadable or malformed. |
| `MARKETPLACE_SHAPE` | Required marketplace fields/types, single plugin entry, or strict flag invalid. |
| `PLUGIN_SHAPE` | Required plugin fields/types or skills path invalid; MVP declares `mcpServers`. |
| `IDENTIFIER_FORMAT` | Marketplace, plugin, skill, or MCP name is not kebab-case. |
| `PLUGIN_IDENTITY` | Marketplace plugin entry name differs from plugin manifest name. |
| `PLUGIN_SOURCE` | Marketplace source is not exactly `./plugins/plugin-playground` or does not resolve to plugin directory. |
| `VERSION_FORMAT` | Marketplace/plugin version is not `MAJOR.MINOR.PATCH`. |
| `VERSION_MATCH` | Marketplace entry and plugin versions differ. |
| `SKILL_DUPLICATE` | More than one discovered skill uses same frontmatter name. |
| `SKILL_DIRECTORY` | Skill directory is invalid or differs from frontmatter name. |
| `SKILL_FRONTMATTER` | Delimiters, required scalar `name`, required scalar `description`, or nonempty body invalid. |
| `MCP_SHAPE` | Top-level/server fields invalid for selected transport. |
| `MCP_DUPLICATE` | Same MCP name appears in more than one discovered `.mcp.json`. |
| `MCP_TRANSPORT` | Transport is outside `local`, `stdio`, `http`, `sse`. |
| `MCP_PACKAGE_PIN` | External package argument lacks exact version. |
| `MCP_INLINE_SECRET` | Secret-like key has literal value or secret-like literal appears anywhere in MCP config. |
| `MCP_ENV_DOCUMENTATION` | Environment variable referenced by MCP config is absent from contributor documentation. |

## Fixture Matrix

`test/fixtures/valid` contains a complete minimal repository. Each invalid fixture contains only files replacing the same paths after the valid fixture is copied. A file named `<path>.delete` causes helper to remove `<path>` before validation.

Exact valid fixture files:

```text
test/fixtures/valid/.github/plugin/marketplace.json
test/fixtures/valid/.github/workflows/validate.yml
test/fixtures/valid/plugins/plugin-playground/plugin.json
test/fixtures/valid/plugins/plugin-playground/skills/example-skill/SKILL.md
test/fixtures/valid/plugins/plugin-playground/examples/mcp/.mcp.json
test/fixtures/valid/CHANGELOG.md
test/fixtures/valid/CONTRIBUTING.md
test/fixtures/valid/LICENSE
test/fixtures/valid/README.md
test/fixtures/valid/SECURITY.md
test/fixtures/valid/package.json
```

| Fixture directory | Exact overlay path and change | Expected rule |
|---|---|---|
| `missing-required-file` | `test/fixtures/invalid/missing-required-file/SECURITY.md.delete` removes `SECURITY.md` | `REQUIRED_FILE` |
| `malformed-marketplace` | `test/fixtures/invalid/malformed-marketplace/.github/plugin/marketplace.json` contains truncated JSON | `JSON_PARSE` |
| `marketplace-shape` | `test/fixtures/invalid/marketplace-shape/.github/plugin/marketplace.json` omits `owner` | `MARKETPLACE_SHAPE` |
| `malformed-plugin` | `test/fixtures/invalid/malformed-plugin/plugins/plugin-playground/plugin.json` contains truncated JSON | `JSON_PARSE` |
| `plugin-shape` | `test/fixtures/invalid/plugin-shape/plugins/plugin-playground/plugin.json` uses `"skills": 42` | `PLUGIN_SHAPE` |
| `plugin-activates-mcp` | `test/fixtures/invalid/plugin-activates-mcp/plugins/plugin-playground/plugin.json` adds `"mcpServers": ".mcp.json"` | `PLUGIN_SHAPE` |
| `identifier-format` | `test/fixtures/invalid/identifier-format/plugins/plugin-playground/plugin.json` uses name `Plugin_Playground` | `IDENTIFIER_FORMAT` |
| `plugin-identity` | `test/fixtures/invalid/plugin-identity/.github/plugin/marketplace.json` uses entry name `other-plugin` | `PLUGIN_IDENTITY` |
| `plugin-source` | `test/fixtures/invalid/plugin-source/.github/plugin/marketplace.json` uses source `../plugin-playground` | `PLUGIN_SOURCE` |
| `version-format` | marketplace and plugin overlays below `test/fixtures/invalid/version-format/` use version `0.1` | `VERSION_FORMAT` |
| `version-match` | `test/fixtures/invalid/version-match/.github/plugin/marketplace.json` uses `0.1.1`; valid plugin remains `0.1.0` | `VERSION_MATCH` |
| `skill-duplicate` | `test/fixtures/invalid/skill-duplicate/plugins/plugin-playground/skills/duplicate/SKILL.md` uses name `example-skill` | `SKILL_DUPLICATE` |
| `skill-directory` | `test/fixtures/invalid/skill-directory/plugins/plugin-playground/skills/wrong-name/SKILL.md` uses name `right-name` | `SKILL_DIRECTORY` |
| `skill-frontmatter` | `test/fixtures/invalid/skill-frontmatter/plugins/plugin-playground/skills/example-skill/SKILL.md` omits `description` | `SKILL_FRONTMATTER` |
| `malformed-mcp` | `test/fixtures/invalid/malformed-mcp/plugins/plugin-playground/examples/mcp/.mcp.json` contains truncated JSON | `JSON_PARSE` |
| `mcp-shape` | `test/fixtures/invalid/mcp-shape/plugins/plugin-playground/examples/mcp/.mcp.json` has stdio server without `command` | `MCP_SHAPE` |
| `mcp-duplicate` | `test/fixtures/invalid/mcp-duplicate/plugins/plugin-playground/.mcp.json` repeats `example-filesystem` | `MCP_DUPLICATE` |
| `mcp-transport` | `test/fixtures/invalid/mcp-transport/plugins/plugin-playground/examples/mcp/.mcp.json` uses type `websocket` | `MCP_TRANSPORT` |
| `mcp-unpinned-package` | `test/fixtures/invalid/mcp-unpinned-package/plugins/plugin-playground/examples/mcp/.mcp.json` uses `@modelcontextprotocol/server-filesystem@latest` | `MCP_PACKAGE_PIN` |
| `mcp-inline-secret-env` | `test/fixtures/invalid/mcp-inline-secret-env/plugins/plugin-playground/examples/mcp/.mcp.json` has `"EXAMPLE_API_TOKEN": "secret-value"` | `MCP_INLINE_SECRET` |
| `mcp-inline-secret-header` | `test/fixtures/invalid/mcp-inline-secret-header/plugins/plugin-playground/examples/mcp/.mcp.json` has `"Authorization": "Bearer abc123"` | `MCP_INLINE_SECRET` |
| `mcp-undocumented-env` | MCP and CONTRIBUTING overlays below `test/fixtures/invalid/mcp-undocumented-env/` reference but do not document `${UNDOCUMENTED_TOKEN}` | `MCP_ENV_DOCUMENTATION` |

---

### Task 1: Core Validation Primitives and CLI Contract

**Files:**
- Create: `package.json`
- Create: `scripts/validate.mjs`
- Create: `scripts/validation/constants.mjs`
- Create: `scripts/validation/diagnostic.mjs`
- Create: `scripts/validation/fs.mjs`
- Create: `scripts/validation/frontmatter.mjs`
- Create: `scripts/validation/repository.mjs`
- Create: `test/diagnostic.test.mjs`
- Create: `test/frontmatter.test.mjs`

**Interfaces:**
- Produces all `diagnostic.mjs`, `fs.mjs`, and `frontmatter.mjs` interfaces defined above.
- Produces package scripts consumed by every later task: `npm run validate`, `npm test`, and `npm run check`.
- CLI initially calls this exact Task 1 implementation; Task 2 replaces its body with real orchestration:

```js
export async function validateRepository() {
  return { diagnostics: [], checkedFiles: 0, mcpEnvironmentVariables: [] };
}
```

- [x] **Step 1: Add package metadata and failing primitive tests**

Create `package.json` exactly:

```json
{
  "name": "plugin-playground",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "validate": "node scripts/validate.mjs",
    "test": "node --test",
    "check": "npm run validate && npm test"
  }
}
```

Write tests asserting:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  diagnostic,
  formatDiagnostic,
  sortDiagnostics,
} from "../scripts/validation/diagnostic.mjs";

test("formats actionable diagnostics", () => {
  const value = diagnostic("b.json", "RULE_B", "bad value", "replace value");
  assert.equal(
    formatDiagnostic(value),
    "b.json [RULE_B] bad value\n  Remediation: replace value",
  );
});

test("sorts diagnostics by file then rule then message", () => {
  const values = [
    diagnostic("b", "A", "z", "fix"),
    diagnostic("a", "B", "z", "fix"),
    diagnostic("a", "A", "z", "fix"),
  ];
  assert.deepEqual(sortDiagnostics(values).map(({ file, rule }) => [file, rule]), [
    ["a", "A"],
    ["a", "B"],
    ["b", "A"],
  ]);
});
```

`test/frontmatter.test.mjs` must cover valid frontmatter/body, missing opening/closing delimiter, duplicate keys, unsupported nested/list values, empty `name`, empty `description`, and empty body. Each invalid case expects `SKILL_FRONTMATTER`.

- [x] **Step 2: Run primitive tests and verify failure**

Run:

```bash
node --test test/diagnostic.test.mjs test/frontmatter.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/validation/diagnostic.mjs`.

- [x] **Step 3: Implement dependency-free primitives**

Use:

```js
export const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const SUPPORTED_MCP_TRANSPORTS = new Set(["local", "stdio", "http", "sse"]);
export const REQUIRED_FILES = [
  ".github/plugin/marketplace.json",
  "plugins/plugin-playground/plugin.json",
  "plugins/plugin-playground/skills/example-skill/SKILL.md",
  "plugins/plugin-playground/examples/mcp/.mcp.json",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "package.json",
];
```

`parseSkillDocument()` must split only on line-delimited `---`, accept simple `key: value` scalars, reject duplicate/unknown complex syntax, and return diagnostics instead of throwing. `readJson()` must preserve parse error details in message without exposing absolute paths. `findFiles()` must sort POSIX-relative paths.

Create CLI adapter with exact behavior:

```js
#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatDiagnostic } from "./validation/diagnostic.mjs";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(process.argv[2] ?? defaultRoot);

try {
  const { validateRepository } = await import("./validation/repository.mjs");
  const result = await validateRepository(root);
  if (result.diagnostics.length === 0) {
    console.log(`Validation passed (${result.checkedFiles} files checked).`);
  } else {
    for (const value of result.diagnostics) console.error(formatDiagnostic(value));
    console.error(
      `Validation failed with ${result.diagnostics.length} ${
        result.diagnostics.length === 1 ? "error" : "errors"
      }.`,
    );
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Validation crashed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
```

- [x] **Step 4: Run primitive tests and verify pass**

Run:

```bash
node --test test/diagnostic.test.mjs test/frontmatter.test.mjs
```

Expected: PASS, 0 failures.

- [x] **Step 5: Commit core primitives**

```bash
git add package.json scripts/validate.mjs scripts/validation/constants.mjs scripts/validation/diagnostic.mjs scripts/validation/fs.mjs scripts/validation/frontmatter.mjs scripts/validation/repository.mjs test/diagnostic.test.mjs test/frontmatter.test.mjs
git commit -m "build: add validation primitives"
```

---

### Task 2: Marketplace and Plugin Manifest Validation

**Files:**
- Create: `scripts/validation/manifests.mjs`
- Modify: `scripts/validation/repository.mjs`
- Create: `test/helpers/fixture.mjs`
- Create: `test/validate.test.mjs`
- Create: `test/fixtures/valid/.github/plugin/marketplace.json`
- Create: `test/fixtures/valid/plugins/plugin-playground/plugin.json`
- Create: all manifest-related invalid overlays from Fixture Matrix
- Create: `.github/plugin/marketplace.json`
- Create: `plugins/plugin-playground/plugin.json`

**Interfaces:**
- Consumes `readJson()`, `pathExists()`, `diagnostic()`, `KEBAB_CASE`, `SEMVER`.
- Produces `validateManifests(root)` returning `{ marketplace, plugin, diagnostics, checkedFiles }`.
- Produces initial `validateRepository(root)` orchestrator; later tasks add skills, MCP, and docs phases without changing return type.

- [x] **Step 1: Create fixture helper and failing manifest tests**

`withFixture(name, callback)` must:

1. Create `await mkdtemp(join(tmpdir(), "plugin-playground-"))`.
2. Recursively copy `test/fixtures/valid`.
3. For invalid fixture, walk overlay paths in sorted order.
4. Remove target for `.delete`; otherwise create parent and copy replacement.
5. Invoke callback with temporary root.
6. Remove only created temporary root using `rm(root, { recursive: true, force: true })` in `finally`.

Add table-driven tests:

```js
const manifestCases = [
  ["malformed-marketplace", "JSON_PARSE"],
  ["marketplace-shape", "MARKETPLACE_SHAPE"],
  ["malformed-plugin", "JSON_PARSE"],
  ["plugin-shape", "PLUGIN_SHAPE"],
  ["plugin-activates-mcp", "PLUGIN_SHAPE"],
  ["identifier-format", "IDENTIFIER_FORMAT"],
  ["plugin-identity", "PLUGIN_IDENTITY"],
  ["plugin-source", "PLUGIN_SOURCE"],
  ["version-format", "VERSION_FORMAT"],
  ["version-match", "VERSION_MATCH"],
];

for (const [fixture, rule] of manifestCases) {
  test(`${fixture} emits ${rule}`, () =>
    withFixture(fixture, async (root) => {
      const result = await validateRepository(root);
      assert.ok(result.diagnostics.some((value) => value.rule === rule));
    })));
}
```

- [x] **Step 2: Run manifest tests and verify failure**

Run:

```bash
node --test test/validate.test.mjs
```

Expected: FAIL because `validateManifests()` and fixture files do not exist.

- [x] **Step 3: Implement exact production and fixture manifests**

Use identical core fields in production and valid fixture:

```json
{
  "name": "plugin-playground",
  "owner": {
    "name": "at00216844"
  },
  "metadata": {
    "description": "Team marketplace for version-controlled GitHub Copilot CLI skills and reviewed MCP configurations.",
    "version": "0.1.0"
  },
  "plugins": [
    {
      "name": "plugin-playground",
      "description": "Example skills and reviewed MCP configuration patterns for GitHub Copilot CLI.",
      "version": "0.1.0",
      "author": {
        "name": "at00216844"
      },
      "homepage": "https://github.com/at00216844/plugin-playground",
      "repository": "https://github.com/at00216844/plugin-playground",
      "keywords": ["copilot-cli", "skills", "mcp"],
      "license": "MIT",
      "source": "./plugins/plugin-playground",
      "strict": true
    }
  ]
}
```

```json
{
  "name": "plugin-playground",
  "description": "Example skills and reviewed MCP configuration patterns for GitHub Copilot CLI.",
  "version": "0.1.0",
  "author": {
    "name": "at00216844"
  },
  "homepage": "https://github.com/at00216844/plugin-playground",
  "repository": "https://github.com/at00216844/plugin-playground",
  "license": "MIT",
  "keywords": ["copilot-cli", "skills", "mcp"],
  "skills": ["skills/"]
}
```

Validator requires top-level marketplace `name`, `owner.name`, `plugins`; exactly one plugin; plugin entry `strict === true`; manifest `name`, `description`, `version`, `author.name`, `license`, and `skills`; `skills` equals `"skills/"` or `["skills/"]`; and absence of `mcpServers`. Check source using `resolve(root, source)` plus containment under root and exact normalized relative value.

- [x] **Step 4: Run manifest tests and verify pass**

Run:

```bash
node --test test/validate.test.mjs
node scripts/validate.mjs test/fixtures/valid
```

Expected: manifest cases PASS. Assert manifest diagnostics are empty rather than whole-repository success until Task 5.

- [x] **Step 5: Commit manifest slice**

```bash
git add .github/plugin/marketplace.json plugins/plugin-playground/plugin.json scripts/validation/manifests.mjs scripts/validation/repository.mjs test/helpers/fixture.mjs test/validate.test.mjs test/fixtures
git commit -m "feat: define marketplace and plugin manifests"
```

---

### Task 3: Skill Validation and Example Skill

**Files:**
- Create: `scripts/validation/skills.mjs`
- Create: `plugins/plugin-playground/skills/example-skill/SKILL.md`
- Create: `test/fixtures/valid/plugins/plugin-playground/skills/example-skill/SKILL.md`
- Create: skill-related invalid overlays from Fixture Matrix
- Modify: `scripts/validation/repository.mjs`
- Modify: `test/validate.test.mjs`

**Interfaces:**
- Consumes `findFiles()`, `readText()`, `parseSkillDocument()`, plugin `skills`.
- Produces `validateSkills(root, plugin)` returning `{ diagnostics, checkedFiles }`.

- [x] **Step 1: Add failing skill rule tests**

Add cases:

```js
const skillCases = [
  ["skill-duplicate", "SKILL_DUPLICATE"],
  ["skill-directory", "SKILL_DIRECTORY"],
  ["skill-frontmatter", "SKILL_FRONTMATTER"],
];
```

Also assert valid fixture discovers exactly one skill and emits no skill diagnostics.

- [x] **Step 2: Run skill tests and verify failure**

Run:

```bash
node --test --test-name-pattern="skill" test/validate.test.mjs
```

Expected: FAIL because `validateSkills()` is not wired and valid skill is absent.

- [x] **Step 3: Implement skill discovery and example**

Create production and fixture skill:

```markdown
---
name: example-skill
description: Use when demonstrating that plugin-playground skills are installed and discoverable without external services.
---

# Example Skill

Respond with `plugin-playground example skill is available`.

Do not call tools, access network resources, modify files, or start processes.
```

Implementation rules:

1. Normalize `plugin.skills` to array.
2. Resolve every skills directory beneath plugin root and reject escape paths as `PLUGIN_SHAPE`.
3. Find every `SKILL.md` recursively.
4. Parse each document.
5. Require parent directory to satisfy `KEBAB_CASE`.
6. Require parsed name to equal parent directory.
7. Group valid parsed names and emit one `SKILL_DUPLICATE` diagnostic on every duplicated file.
8. Require at least one skill for MVP; absence is `PLUGIN_SHAPE`.

- [x] **Step 4: Run skill tests and verify pass**

Run:

```bash
node --test --test-name-pattern="skill" test/validate.test.mjs
```

Expected: PASS, each invalid fixture emits expected rule and valid fixture emits none from skills.

- [x] **Step 5: Commit skill slice**

```bash
git add scripts/validation/skills.mjs scripts/validation/repository.mjs plugins/plugin-playground/skills test/validate.test.mjs test/fixtures
git commit -m "feat: add example skill validation"
```

---

### Task 4: MCP Policy Validation and Inert Template

**Files:**
- Create: `scripts/validation/mcp.mjs`
- Create: `plugins/plugin-playground/examples/mcp/.mcp.json`
- Create: `test/fixtures/valid/plugins/plugin-playground/examples/mcp/.mcp.json`
- Create: all MCP-related invalid overlays from Fixture Matrix
- Modify: `scripts/validation/constants.mjs`
- Modify: `scripts/validation/repository.mjs`
- Modify: `test/validate.test.mjs`

**Interfaces:**
- Consumes `findFiles()`, `readJson()`, `diagnostic()`, `KEBAB_CASE`, `SUPPORTED_MCP_TRANSPORTS`.
- Produces `validateMcpConfigurations(root, plugin)` returning `{ diagnostics, checkedFiles, environmentVariables }`.

- [x] **Step 1: Add failing MCP fixture tests**

Add all MCP cases from Fixture Matrix. Add assertions that:

```js
assert.deepEqual(validResult.mcpEnvironmentVariables, ["EXAMPLE_MCP_ROOT"]);
assert.equal(validResult.diagnostics.some(({ rule }) => rule.startsWith("MCP_")), false);
```

Add positive unit cases for exact package pins:

```text
@modelcontextprotocol/server-filesystem@1.2.3
some-package@0.4.0
@scope/package@10.0.1
```

Add negative cases for missing version, `latest`, `next`, caret, tilde, wildcard, URL package specs, and git specs.

- [x] **Step 2: Run MCP tests and verify failure**

Run:

```bash
node --test --test-name-pattern="mcp|package|secret|environment" test/validate.test.mjs
```

Expected: FAIL because MCP validator and template do not exist.

- [x] **Step 3: Create inert MCP template**

Use exact version-pinned sample:

```json
{
  "mcpServers": {
    "example-filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem@2026.7.10",
        "${EXAMPLE_MCP_ROOT}"
      ],
      "env": {},
      "tools": ["*"]
    }
  }
}
```

Template is illustrative only. Implementation must verify published package/version before any future activation; template location and absent `mcpServers` manifest field keep it inert in MVP.

- [x] **Step 4: Implement shape and transport rules**

Discover every `.mcp.json` below plugin root, including examples. Accept only `{ "mcpServers": { ... } }` top level. For each server:

- Require kebab-case unique name.
- Require object definition and supported `type`.
- For `local|stdio`: require nonempty string `command`; optional `args` must be string array; optional `env` must be string-to-string object.
- For `http|sse`: require absolute `https:` URL; prohibit `command` and `args`; optional `headers` must be string-to-string object.
- Optional `tools` must be nonempty string array.
- Reject unknown transport-specific contradictions as `MCP_SHAPE`.

External package pin algorithm:

```js
const EXACT_PACKAGE =
  /^(?:@([a-z0-9][a-z0-9._-]*)\/)?([a-z0-9][a-z0-9._-]*)@(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const EXACT_PYTHON_PACKAGE =
  /^[A-Za-z0-9][A-Za-z0-9._-]*==(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function packageArgument(args) {
  return args.find((value) =>
    value.startsWith("@") ? value.includes("/", 1) : /^[a-z0-9]/.test(value)
  );
}
```

Apply `EXACT_PACKAGE` when command basename is `npx`, `npm`, `pnpm`, `pnpx`, `yarn`, `bun`, or `bunx`. Apply `EXACT_PYTHON_PACKAGE` when command basename is `uvx` or `pipx`. Skip known flags before package argument. Reject absence or non-exact match.

- [x] **Step 5: Implement secret and environment-variable rules**

Walk every string with JSON path. Secret-like keys match:

```js
/(?:^|_)(?:api[_-]?key|auth|authorization|credential|password|private[_-]?key|secret|token)(?:$|_)/i
```

Allowed secret values are environment references containing only `${UPPER_SNAKE_CASE}` or `$UPPER_SNAKE_CASE`. Empty values are allowed only in `env`/`headers`. Reject literal values under secret-like keys. Independently reject strings matching private-key headers, GitHub tokens (`gh[pousr]_[A-Za-z0-9_]{20,}`), JWT-like values, bearer literals, and common cloud access-key patterns.

Extract variable references using `/\$\{([A-Z][A-Z0-9_]*)\}|\$([A-Z][A-Z0-9_]*)/g`, deduplicate, and sort.

- [x] **Step 6: Run MCP tests and verify pass**

Run:

```bash
node --test --test-name-pattern="mcp|package|secret|environment" test/validate.test.mjs
```

Expected: PASS. Unsafe fixtures produce nonzero diagnostics with exact expected rule.

- [x] **Step 7: Commit MCP policy slice**

```bash
git add scripts/validation scripts/validation/repository.mjs plugins/plugin-playground/examples test/validate.test.mjs test/fixtures
git commit -m "feat: validate inert MCP templates"
```

---

### Task 5: Required Files, Documentation, and Security Guidance

**Files:**
- Create: `scripts/validation/documentation.mjs`
- Create: `README.md`
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `CHANGELOG.md`
- Create: `LICENSE`
- Create matching valid fixture files
- Create: `test/fixtures/invalid/missing-required-file/SECURITY.md.delete`
- Create: `test/fixtures/invalid/mcp-undocumented-env/CONTRIBUTING.md`
- Modify: `scripts/validation/repository.mjs`
- Modify: `test/validate.test.mjs`

**Interfaces:**
- Consumes `REQUIRED_FILES`, `pathExists()`, `readText()`, MCP `environmentVariables`.
- Produces `validateDocumentation(root, variables)` returning `{ diagnostics, checkedFiles }`.
- Completes `validateRepository()` orchestration in order: manifests, skills when plugin parsed, MCP, docs; aggregate/sort diagnostics and checked file count.

- [x] **Step 1: Add failing repository/documentation tests**

Add tests:

```js
test("valid fixture passes every rule", () =>
  withFixture("valid", async (root) => {
    const result = await validateRepository(root);
    assert.deepEqual(result.diagnostics, []);
    assert.ok(result.checkedFiles >= 10);
  }));

test("missing required file fails closed", () =>
  withFixture("missing-required-file", async (root) => {
    const result = await validateRepository(root);
    assert.ok(result.diagnostics.some(({ rule }) => rule === "REQUIRED_FILE"));
  }));

test("every MCP environment variable must be documented", () =>
  withFixture("mcp-undocumented-env", async (root) => {
    const result = await validateRepository(root);
    assert.ok(
      result.diagnostics.some(({ rule }) => rule === "MCP_ENV_DOCUMENTATION"),
    );
  }));
```

- [x] **Step 2: Run full validator tests and verify failure**

Run:

```bash
node --test test/validate.test.mjs
```

Expected: FAIL because repository docs/license and documentation validator are absent.

- [x] **Step 3: Write README with exact operational sections**

Include:

1. `# Plugin Playground`
2. Trust statement: review plugin source and MCP permissions before installation; MCP example is inert and starts no process.
3. Prerequisites: GitHub Copilot CLI with plugin support and Node.js 22+ only for contribution checks.
4. Local installation:

```bash
copilot plugin marketplace add "$(pwd)"
copilot plugin install plugin-playground@plugin-playground
copilot plugin list
```

5. Public installation:

```bash
copilot plugin marketplace add at00216844/plugin-playground
copilot plugin install plugin-playground@plugin-playground
```

6. Update:

```bash
copilot plugin marketplace update plugin-playground
copilot plugin update plugin-playground
```

7. Disable/enable:

```bash
copilot plugin disable plugin-playground
copilot plugin enable plugin-playground
```

8. Uninstall/remove:

```bash
copilot plugin uninstall plugin-playground
copilot plugin marketplace remove plugin-playground
```

9. Local smoke test:

```bash
copilot plugin marketplace add "$(pwd)"
copilot plugin marketplace browse plugin-playground
copilot plugin install plugin-playground@plugin-playground
copilot plugin list
copilot mcp list
copilot
```

Inside interactive Copilot run `/skills list`, confirm `example-skill`, invoke it, confirm exact response `plugin-playground example skill is available`, and confirm `example-filesystem` is absent from `copilot mcp list`. Cleanup uses uninstall then marketplace remove.

10. Troubleshooting table:
   - Invalid marketplace registration: use repository root or `at00216844/plugin-playground`, verify `.github/plugin/marketplace.json`.
   - Stale cache: `copilot plugin marketplace update plugin-playground`, reinstall local plugin because installs are cached.
   - Version mismatch: synchronize both `0.1.0` values and run `npm run check`.
   - Missing runtime command: install command named by activated MCP config and verify `PATH`.
   - Missing environment variable: export documented variable without committing value.
   - Existing installed plugin blocks marketplace removal: uninstall plugin first; do not recommend `--force` as normal path.

- [x] **Step 4: Write contributor and security documents**

`CONTRIBUTING.md` must include exact sections:

- Development prerequisites and `npm run check`.
- Adding a skill: unique matching kebab-case directory/frontmatter; local files only; test discovery.
- Adding an MCP template under `examples/mcp`; exact package pins; `${VARIABLE}` secrets; provenance/license/permissions/data-access review.
- Promoting MCP: move reviewed config to `plugins/plugin-playground/.mcp.json`, add `"mcpServers": ".mcp.json"` to plugin manifest, document commands/packages/URLs/environment variables, add positive and unsafe fixtures, run local smoke test, and obtain maintainer approval.
- `## MCP environment variables` table containing `EXAMPLE_MCP_ROOT | Absolute directory exposed by inert filesystem example | Required only when manually testing template | No default; set locally`.
- Review checklist for behavior, provenance, least privilege, data access, exact versions, no inline secrets, tests, docs.
- Manual release steps copied from spec; explicitly state no automation creates tags, pushes, deploys, or publishes.

`SECURITY.md` must instruct reporters to use GitHub repository **Security > Advisories > New draft security advisory**, not public issues; include affected version/config, reproduction, impact, and suggested mitigation; instruct immediate credential rotation/revocation if a secret was exposed; state maintainers never request secrets.

`CHANGELOG.md` must follow Keep a Changelog:

```markdown
# Changelog

All notable changes to this project are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-13

### Added

- GitHub Copilot CLI marketplace and installable `plugin-playground` plugin.
- Dependency-free example skill and inert MCP configuration template.
- Dependency-free validation, tests, contributor guidance, and CI.
```

Create standard MIT license text with `Copyright (c) 2026 at00216844`.

- [x] **Step 5: Implement documentation validation**

For every `REQUIRED_FILES` entry, verify regular file. Search `CONTRIBUTING.md` and `README.md` as literal text for each MCP variable. Emit one `MCP_ENV_DOCUMENTATION` diagnostic per undocumented variable with remediation naming variable and required `CONTRIBUTING.md` section.

- [x] **Step 6: Run validator tests and production validation**

Run:

```bash
node --test test/validate.test.mjs
npm run validate
```

Expected: PASS. Production validation prints `Validation passed`; valid fixture has zero diagnostics; invalid fixtures emit expected rules.

- [x] **Step 7: Commit documentation slice**

```bash
git add README.md CONTRIBUTING.md SECURITY.md CHANGELOG.md LICENSE scripts/validation/documentation.mjs scripts/validation/repository.mjs test/validate.test.mjs test/fixtures
git commit -m "docs: add plugin operations and security guidance"
```

---

### Task 6: CLI Failure Semantics and Complete Rule Coverage

**Files:**
- Modify: `test/validate.test.mjs`
- Modify: `test/diagnostic.test.mjs`
- Modify: `scripts/validate.mjs`
- Modify: validator modules only where tests expose missing behavior

**Interfaces:**
- Consumes final `validateRepository()` API.
- Locks CLI stdout/stderr/exit-code contract and every stable rule code.

- [x] **Step 1: Add failing subprocess tests**

Use `spawnSync(process.execPath, ["scripts/validate.mjs", fixtureRoot], { cwd: repositoryRoot, encoding: "utf8" })`.

Assert valid fixture:

```js
assert.equal(result.status, 0);
assert.match(result.stdout, /^Validation passed \(\d+ files checked\)\.\n$/);
assert.equal(result.stderr, "");
```

Assert invalid inline-secret fixture:

```js
assert.equal(result.status, 1);
assert.match(result.stderr, /\[MCP_INLINE_SECRET\]/);
assert.match(result.stderr, /Remediation:/);
assert.match(result.stderr, /Validation failed with 1 error\./);
assert.doesNotMatch(result.stderr, fixtureRoot);
```

Assert nonexistent root produces exit `2` and `Validation crashed:` without stack trace.

- [x] **Step 2: Run subprocess tests and verify failure**

Run:

```bash
node --test --test-name-pattern="CLI|subprocess" test/validate.test.mjs
```

Expected: FAIL where CLI behavior differs from contract.

- [x] **Step 3: Make minimal CLI and diagnostic corrections**

Keep validation failures distinct from unexpected I/O/programming failures. Do not add broad catches inside rule modules. Catch only once in CLI boundary. Preserve deterministic diagnostic ordering and repository-relative paths.

- [x] **Step 4: Add rule coverage assertion**

Collect rules produced by all invalid fixture tests and compare to full Stable Rule Catalog:

```js
assert.deepEqual([...coveredRules].sort(), [
  "IDENTIFIER_FORMAT",
  "JSON_PARSE",
  "MARKETPLACE_SHAPE",
  "MCP_DUPLICATE",
  "MCP_ENV_DOCUMENTATION",
  "MCP_INLINE_SECRET",
  "MCP_PACKAGE_PIN",
  "MCP_SHAPE",
  "MCP_TRANSPORT",
  "PLUGIN_IDENTITY",
  "PLUGIN_SHAPE",
  "PLUGIN_SOURCE",
  "REQUIRED_FILE",
  "SKILL_DIRECTORY",
  "SKILL_DUPLICATE",
  "SKILL_FRONTMATTER",
  "VERSION_FORMAT",
  "VERSION_MATCH",
]);
```

- [x] **Step 5: Run full tests and verify pass**

Run:

```bash
npm test
```

Expected: PASS, 0 failures, all rule codes covered.

- [x] **Step 6: Commit CLI behavior**

```bash
git add scripts test
git commit -m "test: lock validator failure semantics"
```

---

### Task 7: GitHub Actions Validation

**Files:**
- Create: `.github/workflows/validate.yml`
- Modify: `README.md`
- Modify: `scripts/validation/constants.mjs`
- Create: `test/fixtures/valid/.github/workflows/validate.yml`
- Modify: `test/validate.test.mjs`

**Interfaces:**
- Consumes `npm run check`.
- Produces no artifacts, releases, tags, deployments, credentials, or authenticated Copilot calls.

- [x] **Step 1: Add workflow contract test**

In `test/validate.test.mjs`, read workflow text and assert it contains:

- `pull_request:`
- `push:`
- matrix entries `22` and `24`
- `npm run check`

Assert it does not contain `deploy`, `release`, `workflow_dispatch`, `secrets.`, `permissions: write-all`, `git tag`, or `npm publish`.

- [x] **Step 2: Run workflow test and verify failure**

Run:

```bash
node --test --test-name-pattern="workflow" test/validate.test.mjs
```

Expected: FAIL because `.github/workflows/validate.yml` is absent.

- [x] **Step 3: Create minimal read-only CI workflow**

```yaml
name: Validate

on:
  pull_request:
  push:

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node-version: [22, 24]
    steps:
      - name: Check out repository
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - name: Run validation and tests
        run: npm run check
```

Because no lockfile or dependencies exist, do not configure dependency caching and do not run `npm install`/`npm ci`. Add `.github/workflows/validate.yml` to `REQUIRED_FILES` and copy the same workflow into valid fixture.

Add README CI section explaining PR/push validation and no Copilot authentication.

- [x] **Step 4: Run workflow and full checks**

Run:

```bash
node --test --test-name-pattern="workflow" test/validate.test.mjs
npm run check
```

Expected: PASS. If `actionlint` already exists locally, additionally run `actionlint .github/workflows/validate.yml`; do not install it.

- [x] **Step 5: Commit CI**

```bash
git add .github/workflows/validate.yml README.md test/validate.test.mjs
git commit -m "ci: validate plugin on Node LTS"
```

---

### Task 8: Local Copilot Smoke Test and Release Readiness

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `CHANGELOG.md` only if smoke testing exposes user-visible correction

**Interfaces:**
- Verifies marketplace registration, plugin installation, skill discovery/invocation, and absence of activated MCP server.
- Does not deploy, tag, push, publish, create release, or merge.

- [x] **Step 1: Run automated quality gate**

Run:

```bash
npm run check
git --no-pager diff --check
git --no-pager status --short
```

Expected: validation/tests PASS; no whitespace errors; only intended repository files changed.

- [x] **Step 2: Run local Copilot marketplace smoke test**

Run only when `command -v copilot` succeeds and CLI is already authenticated:

```bash
copilot plugin marketplace add "$(pwd)"
copilot plugin marketplace browse plugin-playground
copilot plugin install plugin-playground@plugin-playground
copilot plugin list
copilot mcp list
```

Expected:

- Marketplace list/browse includes `plugin-playground`.
- Plugin list includes `plugin-playground@plugin-playground`.
- MCP list does not include `example-filesystem`.

Start interactive `copilot`, run `/skills list`, verify `example-skill`, invoke it, and expect exact response `plugin-playground example skill is available`.

Cleanup:

```bash
copilot plugin uninstall plugin-playground
copilot plugin marketplace remove plugin-playground
```

If Copilot CLI is unavailable or unauthenticated, do not fake success. Record automated checks as complete and leave smoke test explicitly pending for authenticated maintainer execution before release.

- [x] **Step 3: Correct any discovered documentation mismatch**

Update only commands/output in README or CONTRIBUTING to match observed CLI. Re-run `npm run check` after edits.

- [x] **Step 4: Commit smoke-test documentation corrections if needed**

```bash
git add README.md CONTRIBUTING.md CHANGELOG.md
git diff --cached --quiet || git commit -m "docs: align plugin smoke test commands"
```

- [x] **Step 5: Final repository verification**

Run:

```bash
npm run check
git --no-pager diff --check
git --no-pager log --oneline --decorate -8
git --no-pager status --short
```

Expected: all automated checks PASS, focused commits visible, no generated caches or temporary fixture directories, and no remote/tag/deployment/release changes.

---

## Implementation Review Checklist

- [x] Marketplace and plugin both use `plugin-playground`, version `0.1.0`, and exact source `./plugins/plugin-playground`.
- [x] Plugin manifest declares only `skills/`; inert sample exists only below `examples/mcp`.
- [x] Example skill directory and frontmatter name match and require no tools/services.
- [x] Every Stable Rule Catalog entry has at least one invalid fixture and passing assertion.
- [x] Validator uses Node standard library only and reports file, rule, message, remediation.
- [x] Package manifest contains no `dependencies` or `devDependencies`.
- [x] Secrets are environment references only; examples contain no credential-like literal.
- [x] Every MCP package command is exact-version pinned.
- [x] Every MCP environment variable appears in contributor documentation without a value.
- [x] README covers install, update, disable, enable, uninstall, marketplace removal, smoke test, and named troubleshooting failures.
- [x] CONTRIBUTING covers skill addition, MCP template addition/promotion, provenance, permissions, data access, validation, and manual release.
- [x] SECURITY uses private advisory reporting.
- [x] CI is read-only, Node 22/24, validation/test only, and unauthenticated.
- [x] No deployment, publishing, release tagging, push, PR creation, or merge automation exists.
- [x] Automated checks pass; authenticated local Copilot smoke test is completed or explicitly pending before release.
