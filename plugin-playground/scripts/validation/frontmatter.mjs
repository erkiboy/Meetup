import { diagnostic } from "./diagnostic.mjs";

const DELIMITER = "---";

/**
 * Parse a SKILL.md document into frontmatter scalars and body.
 * Returns diagnostics instead of throwing on invalid input.
 *
 * @param {string} file - relative file path for diagnostics
 * @param {string} content - raw file content
 * @returns {{ frontmatter: Record<string,string>, body: string, diagnostics: import('./diagnostic.mjs').Diagnostic[] }}
 */
export function parseSkillDocument(file, content) {
  const diag = (message, remediation) =>
    diagnostic(file, "SKILL_FRONTMATTER", message, remediation);

  const lines = content.split("\n");

  // Must start with opening ---
  if (lines[0].trimEnd() !== DELIMITER) {
    return {
      frontmatter: {},
      body: "",
      diagnostics: [
        diag(
          "Skill document must begin with a '---' frontmatter delimiter",
          "Add '---' as the first line of the document",
        ),
      ],
    };
  }

  // Find closing delimiter
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trimEnd() === DELIMITER) {
      closeIdx = i;
      break;
    }
  }

  if (closeIdx === -1) {
    return {
      frontmatter: {},
      body: "",
      diagnostics: [
        diag(
          "Skill document frontmatter is missing closing '---' delimiter",
          "Add a closing '---' line after the frontmatter fields",
        ),
      ],
    };
  }

  const frontmatterLines = lines.slice(1, closeIdx);
  const bodyLines = lines.slice(closeIdx + 1);
  const body = bodyLines.join("\n");

  const diagnostics = [];
  const frontmatter = {};

  for (const line of frontmatterLines) {
    // Detect list items (lines starting with -)
    if (/^\s*-\s/.test(line)) {
      diagnostics.push(
        diag(
          "Frontmatter list values are not supported; use scalar key: value pairs only",
          "Remove list entries and use simple 'key: value' scalars",
        ),
      );
      continue;
    }

    // Detect indented/nested lines
    if (/^\s+/.test(line) && line.trim().length > 0) {
      diagnostics.push(
        diag(
          "Frontmatter nested values are not supported; use scalar key: value pairs only",
          "Remove nested keys and use simple 'key: value' scalars at the top level",
        ),
      );
      continue;
    }

    // Skip blank lines
    if (line.trim() === "") continue;

    // Expect key: value
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      diagnostics.push(
        diag(
          `Frontmatter line is not a valid 'key: value' scalar: ${JSON.stringify(line)}`,
          "Use the format 'key: value' for each frontmatter field",
        ),
      );
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    if (key in frontmatter) {
      diagnostics.push(
        diag(
          `Duplicate frontmatter key: ${JSON.stringify(key)}`,
          `Remove the duplicate '${key}' key, keeping only one`,
        ),
      );
      continue;
    }

    frontmatter[key] = value;
  }

  // Validate name
  if (!("name" in frontmatter)) {
    diagnostics.push(
      diag("Frontmatter is missing required field 'name'", "Add 'name: <skill-name>' to frontmatter"),
    );
  } else if (frontmatter.name === "") {
    diagnostics.push(
      diag("Frontmatter field 'name' must not be empty", "Set 'name' to a non-empty skill name"),
    );
  }

  // Validate description
  if (!("description" in frontmatter)) {
    diagnostics.push(
      diag(
        "Frontmatter is missing required field 'description'",
        "Add 'description: <text>' to frontmatter",
      ),
    );
  } else if (frontmatter.description === "") {
    diagnostics.push(
      diag(
        "Frontmatter field 'description' must not be empty",
        "Set 'description' to a non-empty description string",
      ),
    );
  }

  // Validate body is non-empty
  if (body.trim() === "") {
    diagnostics.push(
      diag(
        "Skill document body must not be empty",
        "Add meaningful content below the closing '---' delimiter",
      ),
    );
  }

  return { frontmatter, body, diagnostics };
}
