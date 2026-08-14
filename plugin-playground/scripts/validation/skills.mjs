import { resolve, normalize, relative, basename, dirname } from "node:path";
import { findFiles, readText } from "./fs.mjs";
import { parseSkillDocument } from "./frontmatter.mjs";
import { diagnostic } from "./diagnostic.mjs";
import { KEBAB_CASE } from "./constants.mjs";

/**
 * Validate all skills for a plugin.
 *
 * @param {string} root - absolute repository root
 * @param {string} pluginDir - absolute plugin directory
 * @param {unknown} plugin - parsed plugin.json data
 * @returns {Promise<{ diagnostics: import('./diagnostic.mjs').Diagnostic[], checkedFiles: number, skillCount: number }>}
 */
export async function validateSkills(root, pluginDir, plugin) {
  const diagnostics = [];
  let checkedFiles = 0;

  // Normalize plugin.skills to array
  const rawSkills = plugin != null && plugin.skills != null ? plugin.skills : [];
  const skillDirs = Array.isArray(rawSkills) ? rawSkills : [rawSkills];

  if (skillDirs.length === 0) {
    diagnostics.push(
      diagnostic(
        relative(root, pluginDir) + "/plugin.json",
        "PLUGIN_SHAPE",
        "Plugin must declare at least one skills directory.",
        "Add a \"skills\" field pointing to the skills directory in plugin.json.",
      ),
    );
    return { diagnostics, checkedFiles, skillCount: 0 };
  }

  const rootNorm = normalize(root);
  /** @type {Map<string, string[]>} name -> file paths */
  const nameToFiles = new Map();

  for (const skillsEntry of skillDirs) {
    if (typeof skillsEntry !== "string") continue;

    const resolvedSkillsDir = normalize(resolve(pluginDir, skillsEntry));

    // Reject escape paths
    if (!resolvedSkillsDir.startsWith(rootNorm + "/") && resolvedSkillsDir !== rootNorm) {
      diagnostics.push(
        diagnostic(
          relative(root, pluginDir) + "/plugin.json",
          "PLUGIN_SHAPE",
          `Skills directory "${skillsEntry}" resolves outside the repository root.`,
          "Set skills to a path inside the repository root.",
        ),
      );
      continue;
    }

    // Find all SKILL.md files
    const files = await findFiles(resolvedSkillsDir);
    const skillFiles = files.filter((f) => f.endsWith("SKILL.md") || f === "SKILL.md" || f.endsWith("/SKILL.md"));

    for (const relToSkillsDir of skillFiles) {
      const absFile = resolve(resolvedSkillsDir, relToSkillsDir);
      const relFile = relative(root, absFile);
      checkedFiles++;

      // Parent directory must satisfy KEBAB_CASE
      const parentDir = basename(dirname(absFile));
      if (!KEBAB_CASE.test(parentDir)) {
        diagnostics.push(
          diagnostic(
            relFile,
            "SKILL_DIRECTORY",
            `Skill directory name "${parentDir}" must be kebab-case.`,
            "Rename the skill directory to use only lowercase letters, digits, and hyphens.",
          ),
        );
        continue;
      }

      const content = await readText(absFile);
      if (content === null) {
        diagnostics.push(
          diagnostic(relFile, "SKILL_FRONTMATTER", `Could not read ${relFile}.`, "Ensure the file is readable."),
        );
        continue;
      }

      const parsed = parseSkillDocument(relFile, content);
      diagnostics.push(...parsed.diagnostics);

      if (parsed.diagnostics.length > 0) continue;

      const parsedName = parsed.frontmatter.name;

      // Rule 6: parsed name must equal parent directory
      if (parsedName !== parentDir) {
        diagnostics.push(
          diagnostic(
            relFile,
            "SKILL_DIRECTORY",
            `Skill name "${parsedName}" does not match its parent directory "${parentDir}".`,
            `Rename the skill directory to "${parsedName}" or update the name field to "${parentDir}".`,
          ),
        );
        continue;
      }

      if (!nameToFiles.has(parsedName)) {
        nameToFiles.set(parsedName, []);
      }
      nameToFiles.get(parsedName).push(relFile);
    }
  }

  // Emit SKILL_DUPLICATE for every file in a duplicated group
  for (const [name, files] of nameToFiles) {
    if (files.length > 1) {
      for (const f of files) {
        diagnostics.push(
          diagnostic(
            f,
            "SKILL_DUPLICATE",
            `Duplicate skill name "${name}" found in multiple files: ${files.join(", ")}.`,
            "Ensure each skill has a unique name.",
          ),
        );
      }
    }
  }

  // Require at least one valid skill
  if (nameToFiles.size === 0) {
    diagnostics.push(
      diagnostic(
        relative(root, pluginDir) + "/plugin.json",
        "PLUGIN_SHAPE",
        "Plugin must contain at least one skill.",
        "Add a SKILL.md file inside the skills directory.",
      ),
    );
  }

  const skillCount = nameToFiles.size;
  return { diagnostics, checkedFiles, skillCount };
}
