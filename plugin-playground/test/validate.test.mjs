import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withFixture } from "./helpers/fixture.mjs";
import { validateRepository } from "../scripts/validation/repository.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const script = path.resolve(repoRoot, "scripts/validate.mjs");

function runCLI(fixtureRoot) {
  return spawnSync(process.execPath, [script, fixtureRoot], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

// --- CLI subprocess tests ---

test("CLI: valid fixture exits 0 with pass message on stdout", () => {
  const fixtureRoot = path.resolve(__dirname, "fixtures/valid");
  const result = runCLI(fixtureRoot);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^Validation passed \(\d+ files checked\)\.\n$/);
  assert.equal(result.stderr, "");
});

test("CLI: inline-secret fixture exits 1 with exactly one error on stderr", () => {
  const fixtureRoot = path.resolve(__dirname, "fixtures/cli-inline-secret");
  const result = runCLI(fixtureRoot);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[MCP_INLINE_SECRET\]/);
  assert.match(result.stderr, /Remediation:/);
  assert.match(result.stderr, /Validation failed with 1 error\./);
  assert.doesNotMatch(result.stderr, new RegExp(fixtureRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(result.stdout, "");
});

test("CLI: nonexistent root exits 2 with crash message", () => {
  const result = runCLI(path.resolve(__dirname, "fixtures/does-not-exist"));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Validation crashed:/);
  assert.doesNotMatch(result.stderr, /at\s+/); // no stack trace
  assert.doesNotMatch(result.stderr, /REQUIRED_FILE/); // not a list of diagnostics
  assert.equal(result.stdout, "");
});

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
      assert.ok(
        result.diagnostics.some((value) => value.rule === rule),
        `Expected diagnostic rule "${rule}" but got: ${JSON.stringify(result.diagnostics.map((d) => d.rule))}`,
      );
    }));
}

test("valid fixture has no manifest diagnostics", () =>
  withFixture("valid", async (root) => {
    const result = await validateRepository(root);
    const manifestRules = new Set([
      "JSON_PARSE",
      "MARKETPLACE_SHAPE",
      "PLUGIN_SHAPE",
      "IDENTIFIER_FORMAT",
      "PLUGIN_IDENTITY",
      "PLUGIN_SOURCE",
      "VERSION_FORMAT",
      "VERSION_MATCH",
    ]);
    const manifestDiagnostics = result.diagnostics.filter((d) => manifestRules.has(d.rule));
    assert.deepEqual(manifestDiagnostics, [], `Unexpected manifest diagnostics: ${JSON.stringify(manifestDiagnostics)}`);
  }));

const skillCases = [
  ["skill-duplicate", "SKILL_DUPLICATE"],
  ["skill-directory", "SKILL_DIRECTORY"],
  ["skill-name-mismatch", "SKILL_DIRECTORY"],
  ["skill-frontmatter", "SKILL_FRONTMATTER"],
];

for (const [fixture, rule] of skillCases) {
  test(`skill: ${fixture} emits ${rule}`, () =>
    withFixture(fixture, async (root) => {
      const result = await validateRepository(root);
      assert.ok(
        result.diagnostics.some((value) => value.rule === rule),
        `Expected diagnostic rule "${rule}" but got: ${JSON.stringify(result.diagnostics.map((d) => d.rule))}`,
      );
    }));
}

test("skill: valid fixture discovers exactly one skill and emits no skill diagnostics", () =>
  withFixture("valid", async (root) => {
    const result = await validateRepository(root);
    const skillRules = new Set(["SKILL_DUPLICATE", "SKILL_DIRECTORY", "SKILL_FRONTMATTER"]);
    const skillDiagnostics = result.diagnostics.filter((d) => skillRules.has(d.rule));
    assert.deepEqual(skillDiagnostics, [], `Unexpected skill diagnostics: ${JSON.stringify(skillDiagnostics)}`);
    assert.equal(result.skillCount, 1, `Expected exactly 1 skill, got ${result.skillCount}`);
  }));

// --- MCP validation cases ---

const mcpCases = [
  ["mcp-malformed", "JSON_PARSE"],
  ["mcp-shape", "MCP_SHAPE"],
  ["mcp-duplicate", "MCP_DUPLICATE"],
  ["mcp-transport", "MCP_TRANSPORT"],
  ["mcp-server-name", "IDENTIFIER_FORMAT"],
  ["mcp-unpinned-package", "MCP_PACKAGE_PIN"],
  ["mcp-inline-secret-env", "MCP_INLINE_SECRET"],
  ["mcp-inline-secret-header", "MCP_INLINE_SECRET"],
  ["mcp-http-shape", "MCP_SHAPE"],
];

for (const [fixture, rule] of mcpCases) {
  test(`mcp: ${fixture} emits ${rule}`, () =>
    withFixture(fixture, async (root) => {
      const result = await validateRepository(root);
      assert.ok(
        result.diagnostics.some((value) => value.rule === rule),
        `Expected diagnostic rule "${rule}" but got: ${JSON.stringify(result.diagnostics.map((d) => d.rule))}`,
      );
    }));
}

test("mcp: valid fixture extracts environment variables and emits no mcp diagnostics", () =>
  withFixture("valid", async (root) => {
    const result = await validateRepository(root);
    assert.deepEqual(result.mcpEnvironmentVariables, ["EXAMPLE_MCP_ROOT"]);
    assert.equal(
      result.diagnostics.some(({ rule }) => rule.startsWith("MCP_")),
      false,
      `Unexpected MCP diagnostics: ${JSON.stringify(result.diagnostics.filter((d) => d.rule.startsWith("MCP_")))}`,
    );
  }));

// --- Documentation / repository integration cases ---

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

// --- CI workflow contract tests ---

import { readFileSync } from "node:fs";

test("workflow: validate.yml contains required triggers and matrix", () => {
  const workflowPath = path.resolve(repoRoot, ".github/workflows/validate.yml");
  const text = readFileSync(workflowPath, "utf8");

  assert.ok(text.includes("pull_request:"), "must trigger on pull_request");
  assert.ok(text.includes("push:"), "must trigger on push");
  assert.ok(text.includes("22"), "matrix must include node 22");
  assert.ok(text.includes("24"), "matrix must include node 24");
  assert.ok(text.includes("npm run check"), "must run npm run check");
});

test("workflow: validate.yml does not contain forbidden operations", () => {
  const workflowPath = path.resolve(repoRoot, ".github/workflows/validate.yml");
  const text = readFileSync(workflowPath, "utf8");

  const forbidden = [
    "deploy",
    "release",
    "workflow_dispatch",
    "secrets.",
    "permissions: write-all",
    "git tag",
    "npm publish",
  ];
  for (const word of forbidden) {
    assert.ok(!text.includes(word), `workflow must not contain "${word}"`);
  }
});

// --- Package pin unit cases ---

import { validateMcpConfigurations } from "../scripts/validation/mcp.mjs";
import { resolve } from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";

/**
 * Helper: create a temp .mcp.json with a single server and validate.
 */
async function validateSingleServer(serverName, serverDef) {
  const dir = await mkdtemp(resolve(tmpdir(), "mcp-pin-"));
  try {
    await writeFile(
      resolve(dir, ".mcp.json"),
      JSON.stringify({ mcpServers: { [serverName]: serverDef } }),
    );
    return await validateMcpConfigurations(dir, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("package pin: exact npm pins are accepted", async () => {
  const good = [
    "@modelcontextprotocol/server-filesystem@1.2.3",
    "some-package@0.4.0",
    "@scope/package@10.0.1",
  ];
  for (const pkg of good) {
    const result = await validateSingleServer("test-server", {
      type: "stdio",
      command: "npx",
      args: ["-y", pkg],
    });
    assert.equal(
      result.diagnostics.some((d) => d.rule === "MCP_PACKAGE_PIN"),
      false,
      `Expected ${pkg} to be accepted but got pin diagnostic`,
    );
  }
});

test("package pin: missing version is rejected", async () => {
  const result = await validateSingleServer("test-server", {
    type: "stdio",
    command: "npx",
    args: ["-y", "some-package"],
  });
  assert.ok(result.diagnostics.some((d) => d.rule === "MCP_PACKAGE_PIN"));
});

test("package pin: latest tag is rejected", async () => {
  const result = await validateSingleServer("test-server", {
    type: "stdio",
    command: "npx",
    args: ["-y", "some-package@latest"],
  });
  assert.ok(result.diagnostics.some((d) => d.rule === "MCP_PACKAGE_PIN"));
});

test("package pin: next tag is rejected", async () => {
  const result = await validateSingleServer("test-server", {
    type: "stdio",
    command: "npx",
    args: ["-y", "some-package@next"],
  });
  assert.ok(result.diagnostics.some((d) => d.rule === "MCP_PACKAGE_PIN"));
});

test("package pin: caret range is rejected", async () => {
  const result = await validateSingleServer("test-server", {
    type: "stdio",
    command: "npx",
    args: ["-y", "some-package@^1.0.0"],
  });
  assert.ok(result.diagnostics.some((d) => d.rule === "MCP_PACKAGE_PIN"));
});

test("package pin: tilde range is rejected", async () => {
  const result = await validateSingleServer("test-server", {
    type: "stdio",
    command: "npx",
    args: ["-y", "some-package@~1.0.0"],
  });
  assert.ok(result.diagnostics.some((d) => d.rule === "MCP_PACKAGE_PIN"));
});

test("package pin: wildcard is rejected", async () => {
  const result = await validateSingleServer("test-server", {
    type: "stdio",
    command: "npx",
    args: ["-y", "some-package@*"],
  });
  assert.ok(result.diagnostics.some((d) => d.rule === "MCP_PACKAGE_PIN"));
});

test("package pin: URL spec is rejected", async () => {
  const result = await validateSingleServer("test-server", {
    type: "stdio",
    command: "npx",
    args: ["-y", "https://example.com/pkg.tgz"],
  });
  assert.ok(result.diagnostics.some((d) => d.rule === "MCP_PACKAGE_PIN"));
});

test("package pin: git spec is rejected", async () => {
  const result = await validateSingleServer("test-server", {
    type: "stdio",
    command: "npx",
    args: ["-y", "github:user/repo"],
  });
  assert.ok(result.diagnostics.some((d) => d.rule === "MCP_PACKAGE_PIN"));
});

test("package pin: exact python pin via uvx is accepted", async () => {
  const result = await validateSingleServer("test-server", {
    type: "stdio",
    command: "uvx",
    args: ["mcp-server-fetch==1.2.3"],
  });
  assert.equal(
    result.diagnostics.some((d) => d.rule === "MCP_PACKAGE_PIN"),
    false,
  );
});

test("package pin: python non-exact via uvx is rejected", async () => {
  const result = await validateSingleServer("test-server", {
    type: "stdio",
    command: "uvx",
    args: ["mcp-server-fetch"],
  });
  assert.ok(result.diagnostics.some((d) => d.rule === "MCP_PACKAGE_PIN"));
});

// --- Secret / environment variable cases ---

test("secret: env var reference in secret key is accepted", async () => {
  const result = await validateSingleServer("test-server", {
    type: "stdio",
    command: "npx",
    args: ["-y", "some-package@1.0.0"],
    env: { API_KEY: "${MY_API_KEY}" },
  });
  assert.equal(
    result.diagnostics.some((d) => d.rule === "MCP_INLINE_SECRET"),
    false,
  );
});

test("secret: literal value in secret key is rejected", async () => {
  const result = await validateSingleServer("test-server", {
    type: "stdio",
    command: "npx",
    args: ["-y", "some-package@1.0.0"],
    env: { AUTH_TOKEN: "hardcoded-token-value" },
  });
  assert.ok(result.diagnostics.some((d) => d.rule === "MCP_INLINE_SECRET"));
});

test("secret: empty env value is allowed", async () => {
  const result = await validateSingleServer("test-server", {
    type: "stdio",
    command: "npx",
    args: ["-y", "some-package@1.0.0"],
    env: { SECRET: "" },
  });
  assert.equal(
    result.diagnostics.some((d) => d.rule === "MCP_INLINE_SECRET"),
    false,
  );
});

test("environment: variables are extracted and sorted", async () => {
  const result = await validateSingleServer("test-server", {
    type: "stdio",
    command: "npx",
    args: ["-y", "some-package@1.0.0", "${ZEBRA_VAR}"],
    env: { SOME_KEY: "${ALPHA_VAR}" },
  });
  assert.deepEqual(result.environmentVariables, ["ALPHA_VAR", "ZEBRA_VAR"]);
});

// --- Stable rule catalog coverage ---

test("rule catalog: all stable rules are covered by invalid-fixture tests", async () => {
  const coveredRules = new Set();
  const invalidFixtures = [
    "malformed-marketplace",
    "marketplace-shape",
    "malformed-plugin",
    "plugin-shape",
    "plugin-activates-mcp",
    "identifier-format",
    "plugin-identity",
    "plugin-source",
    "version-format",
    "version-match",
    "skill-duplicate",
    "skill-directory",
    "skill-name-mismatch",
    "skill-frontmatter",
    "mcp-malformed",
    "mcp-shape",
    "mcp-duplicate",
    "mcp-transport",
    "mcp-server-name",
    "mcp-unpinned-package",
    "mcp-inline-secret-env",
    "mcp-inline-secret-header",
    "mcp-http-shape",
    "missing-required-file",
    "mcp-undocumented-env",
  ];
  for (const fixture of invalidFixtures) {
    await withFixture(fixture, async (root) => {
      const result = await validateRepository(root);
      for (const d of result.diagnostics) coveredRules.add(d.rule);
    });
  }
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
});
