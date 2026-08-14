import { resolve } from "node:path";
import { pathExists, readText } from "./fs.mjs";
import { diagnostic } from "./diagnostic.mjs";
import { REQUIRED_FILES } from "./constants.mjs";

/**
 * Validate required files exist and MCP environment variables are documented.
 *
 * @param {string} root - absolute repository root
 * @param {string[]} variables - MCP environment variable names to check
 * @returns {Promise<{ diagnostics: import('./diagnostic.mjs').Diagnostic[], checkedFiles: number }>}
 */
export async function validateDocumentation(root, variables) {
  const diagnostics = [];
  let checkedFiles = 0;

  for (const rel of REQUIRED_FILES) {
    checkedFiles++;
    const abs = resolve(root, rel);
    const exists = await pathExists(abs);
    if (!exists) {
      diagnostics.push(
        diagnostic(
          rel,
          "REQUIRED_FILE",
          `Required file "${rel}" is missing.`,
          `Create ${rel} in the repository root.`,
        ),
      );
    }
  }

  const docFiles = ["CONTRIBUTING.md", "README.md"];
  const docTexts = [];
  for (const name of docFiles) {
    const content = await readText(resolve(root, name));
    if (content != null) {
      docTexts.push(content);
    }
  }
  const combined = docTexts.join("\n");

  for (const varName of variables) {
    if (!combined.includes(varName)) {
      diagnostics.push(
        diagnostic(
          "CONTRIBUTING.md",
          "MCP_ENV_DOCUMENTATION",
          `MCP environment variable "${varName}" is not documented.`,
          `Add ${varName} to the "MCP environment variables" section in CONTRIBUTING.md.`,
        ),
      );
    }
  }

  return { diagnostics, checkedFiles };
}
