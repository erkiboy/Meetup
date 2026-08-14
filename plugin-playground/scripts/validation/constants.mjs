export const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const SUPPORTED_MCP_TRANSPORTS = new Set(["local", "stdio", "http", "sse"]);
export const REQUIRED_FILES = [
  ".github/plugin/marketplace.json",
  ".github/workflows/validate.yml",
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
