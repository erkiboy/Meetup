import { resolve } from "node:path";
import { access } from "node:fs/promises";
import { validateManifests } from "./manifests.mjs";
import { validateSkills } from "./skills.mjs";
import { validateMcpConfigurations } from "./mcp.mjs";
import { validateDocumentation } from "./documentation.mjs";
import { sortDiagnostics } from "./diagnostic.mjs";

export async function validateRepository(root) {
  await access(root).catch(() => {
    throw new Error(`Repository root does not exist: ${root}`);
  });
  const manifests = await validateManifests(root);

  const diagnostics = [...manifests.diagnostics];
  let checkedFiles = manifests.checkedFiles;
  let skillCount = 0;
  let mcpEnvironmentVariables = [];

  // Only validate skills and MCP if manifests succeeded and we have a plugin
  if (manifests.plugin != null) {
    const pluginDir = resolve(root, "plugins/plugin-playground");
    const skills = await validateSkills(root, pluginDir, manifests.plugin);
    diagnostics.push(...skills.diagnostics);
    checkedFiles += skills.checkedFiles;
    skillCount = skills.skillCount;

    const mcp = await validateMcpConfigurations(root, pluginDir);
    diagnostics.push(...mcp.diagnostics);
    checkedFiles += mcp.checkedFiles;
    mcpEnvironmentVariables = mcp.environmentVariables;
  }

  const docs = await validateDocumentation(root, mcpEnvironmentVariables);
  diagnostics.push(...docs.diagnostics);
  checkedFiles += docs.checkedFiles;

  return {
    diagnostics: sortDiagnostics(diagnostics),
    checkedFiles,
    skillCount,
    mcpEnvironmentVariables,
  };
}
