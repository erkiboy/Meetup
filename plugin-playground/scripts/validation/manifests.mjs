import { resolve, relative, normalize } from "node:path";
import { readJson } from "./fs.mjs";
import { diagnostic } from "./diagnostic.mjs";
import { KEBAB_CASE, SEMVER } from "./constants.mjs";

const MARKETPLACE_FILE = ".github/plugin/marketplace.json";

/**
 * Validate marketplace and plugin manifest files.
 *
 * @param {string} root - absolute repository root
 * @returns {Promise<{ marketplace: unknown, plugin: unknown, diagnostics: import('./diagnostic.mjs').Diagnostic[], checkedFiles: number }>}
 */
export async function validateManifests(root) {
  const diagnostics = [];
  let checkedFiles = 0;
  let marketplace = null;
  let plugin = null;

  // --- marketplace.json ---
  const marketplacePath = resolve(root, MARKETPLACE_FILE);
  const { data: marketplaceData, error: marketplaceError } = await readJson(
    marketplacePath,
    MARKETPLACE_FILE,
  );
  checkedFiles++;

  if (marketplaceError) {
    diagnostics.push(
      diagnostic(
        MARKETPLACE_FILE,
        "JSON_PARSE",
        marketplaceError,
        `Ensure ${MARKETPLACE_FILE} is valid JSON.`,
      ),
    );
    return { marketplace, plugin, diagnostics, checkedFiles };
  }

  marketplace = marketplaceData;

  // Shape: name, owner.name, plugins array
  const marketplaceName =
    marketplace != null &&
    typeof marketplace === "object" &&
    typeof marketplace.name === "string"
      ? marketplace.name
      : null;
  const ownerName =
    marketplace != null &&
    typeof marketplace === "object" &&
    marketplace.owner != null &&
    typeof marketplace.owner.name === "string"
      ? marketplace.owner.name
      : null;
  const plugins =
    marketplace != null &&
    typeof marketplace === "object" &&
    Array.isArray(marketplace.plugins)
      ? marketplace.plugins
      : null;

  if (marketplaceName === null || ownerName === null || plugins === null) {
    diagnostics.push(
      diagnostic(
        MARKETPLACE_FILE,
        "MARKETPLACE_SHAPE",
        `${MARKETPLACE_FILE} must have string "name", object "owner" with string "name", and array "plugins".`,
        `Add the required top-level fields to ${MARKETPLACE_FILE}.`,
      ),
    );
    return { marketplace, plugin, diagnostics, checkedFiles };
  }

  // Identifier format: marketplace name
  if (!KEBAB_CASE.test(marketplaceName)) {
    diagnostics.push(
      diagnostic(
        MARKETPLACE_FILE,
        "IDENTIFIER_FORMAT",
        `"name" value "${marketplaceName}" must match kebab-case pattern.`,
        `Use a kebab-case name (e.g. "plugin-playground") in ${MARKETPLACE_FILE}.`,
      ),
    );
  }

  // Exactly one plugin
  if (plugins.length !== 1) {
    diagnostics.push(
      diagnostic(
        MARKETPLACE_FILE,
        "MARKETPLACE_SHAPE",
        `"plugins" must contain exactly one entry; found ${plugins.length}.`,
        `Ensure exactly one plugin entry is listed in ${MARKETPLACE_FILE}.`,
      ),
    );
    return { marketplace, plugin, diagnostics, checkedFiles };
  }

  const entry = plugins[0];

  // Plugin entry must have strict === true
  if (
    entry == null ||
    typeof entry !== "object" ||
    entry.strict !== true
  ) {
    diagnostics.push(
      diagnostic(
        MARKETPLACE_FILE,
        "MARKETPLACE_SHAPE",
        `Plugin entry must have "strict": true.`,
        `Add "strict": true to the plugin entry in ${MARKETPLACE_FILE}.`,
      ),
    );
  }

  // Plugin entry version format
  const entryVersion =
    entry != null && typeof entry.version === "string" ? entry.version : null;
  if (entryVersion !== null && !SEMVER.test(entryVersion)) {
    diagnostics.push(
      diagnostic(
        MARKETPLACE_FILE,
        "VERSION_FORMAT",
        `Plugin entry "version" value "${entryVersion}" is not a valid semver string.`,
        `Use a semver version (e.g. "0.1.0") in ${MARKETPLACE_FILE}.`,
      ),
    );
  }

  // Plugin entry source: must resolve inside root
  const entrySource =
    entry != null && typeof entry.source === "string" ? entry.source : null;
  let resolvedPluginDir = null;
  if (entrySource !== null) {
    const resolved = normalize(resolve(root, entrySource));
    const rootNorm = normalize(root);
    if (!resolved.startsWith(rootNorm + "/") && resolved !== rootNorm) {
      diagnostics.push(
        diagnostic(
          MARKETPLACE_FILE,
          "PLUGIN_SOURCE",
          `Plugin "source" "${entrySource}" resolves outside the repository root.`,
          `Set "source" to a path inside the repository root, e.g. "./plugins/plugin-playground".`,
        ),
      );
    } else {
      // Validate the normalized relative value
      const rel = relative(root, resolved);
      const expectedRel = "plugins/plugin-playground";
      if (rel !== expectedRel) {
        diagnostics.push(
          diagnostic(
            MARKETPLACE_FILE,
            "PLUGIN_SOURCE",
            `Plugin "source" resolves to "${rel}" but expected "${expectedRel}".`,
            `Set "source" to "./plugins/plugin-playground" in ${MARKETPLACE_FILE}.`,
          ),
        );
      } else {
        resolvedPluginDir = resolved;
      }
    }
  } else {
    diagnostics.push(
      diagnostic(
        MARKETPLACE_FILE,
        "MARKETPLACE_SHAPE",
        `Plugin entry is missing required field "source".`,
        `Add a "source" field pointing to the plugin directory in ${MARKETPLACE_FILE}.`,
      ),
    );
  }

  // --- plugin.json ---
  if (resolvedPluginDir !== null) {
    const pluginRelFile = relative(root, resolve(resolvedPluginDir, "plugin.json"));
    const pluginAbsFile = resolve(resolvedPluginDir, "plugin.json");
    const { data: pluginData, error: pluginError } = await readJson(pluginAbsFile, pluginRelFile);
    checkedFiles++;

    if (pluginError) {
      diagnostics.push(
        diagnostic(
          pluginRelFile,
          "JSON_PARSE",
          pluginError,
          `Ensure ${pluginRelFile} is valid JSON.`,
        ),
      );
      return { marketplace, plugin, diagnostics, checkedFiles };
    }

    plugin = pluginData;

    // Shape: name, description, version, author.name, license, skills
    const pName =
      plugin != null && typeof plugin.name === "string" ? plugin.name : null;
    const pDescription =
      plugin != null && typeof plugin.description === "string" ? plugin.description : null;
    const pVersion =
      plugin != null && typeof plugin.version === "string" ? plugin.version : null;
    const pAuthorName =
      plugin != null &&
      plugin.author != null &&
      typeof plugin.author.name === "string"
        ? plugin.author.name
        : null;
    const pLicense =
      plugin != null && typeof plugin.license === "string" ? plugin.license : null;
    const pSkills = plugin != null ? plugin.skills : undefined;
    const pMcpServers = plugin != null ? plugin.mcpServers : undefined;

    const missingFields = [];
    if (pName === null) missingFields.push("name");
    if (pDescription === null) missingFields.push("description");
    if (pVersion === null) missingFields.push("version");
    if (pAuthorName === null) missingFields.push("author.name");
    if (pLicense === null) missingFields.push("license");

    // skills must be "skills/" or ["skills/"]
    const skillsValid =
      pSkills === "skills/" ||
      (Array.isArray(pSkills) && pSkills.length === 1 && pSkills[0] === "skills/");
    if (!skillsValid) missingFields.push("skills");

    if (missingFields.length > 0) {
      diagnostics.push(
        diagnostic(
          pluginRelFile,
          "PLUGIN_SHAPE",
          `${pluginRelFile} is missing or has invalid fields: ${missingFields.join(", ")}.`,
          `Ensure all required fields are present and correct in ${pluginRelFile}.`,
        ),
      );
    }

    // mcpServers must be absent
    if (pMcpServers !== undefined) {
      diagnostics.push(
        diagnostic(
          pluginRelFile,
          "PLUGIN_SHAPE",
          `${pluginRelFile} must not contain "mcpServers" field.`,
          `Remove "mcpServers" from ${pluginRelFile}.`,
        ),
      );
    }

    // Identity: plugin.name must match marketplace entry name
    const entryName =
      entry != null && typeof entry.name === "string" ? entry.name : null;
    if (pName !== null && entryName !== null && pName !== entryName) {
      diagnostics.push(
        diagnostic(
          pluginRelFile,
          "PLUGIN_IDENTITY",
          `plugin.json "name" "${pName}" does not match marketplace entry "name" "${entryName}".`,
          `Ensure the "name" field in plugin.json matches the marketplace entry.`,
        ),
      );
    }

    // Version format for plugin.json
    if (pVersion !== null && !SEMVER.test(pVersion)) {
      diagnostics.push(
        diagnostic(
          pluginRelFile,
          "VERSION_FORMAT",
          `plugin.json "version" "${pVersion}" is not a valid semver string.`,
          `Use a semver version (e.g. "0.1.0") in ${pluginRelFile}.`,
        ),
      );
    }

    // Version match between marketplace entry and plugin.json
    if (
      entryVersion !== null &&
      pVersion !== null &&
      SEMVER.test(entryVersion) &&
      SEMVER.test(pVersion) &&
      entryVersion !== pVersion
    ) {
      diagnostics.push(
        diagnostic(
          pluginRelFile,
          "VERSION_MATCH",
          `Version mismatch: marketplace entry "${entryVersion}" vs plugin.json "${pVersion}".`,
          `Ensure both files use the same version string.`,
        ),
      );
    }
  }

  return { marketplace, plugin, diagnostics, checkedFiles };
}
