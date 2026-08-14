import { resolve, relative, basename } from "node:path";
import { findFiles, readJson } from "./fs.mjs";
import { diagnostic } from "./diagnostic.mjs";
import { KEBAB_CASE, SUPPORTED_MCP_TRANSPORTS } from "./constants.mjs";

const EXACT_PACKAGE =
  /^(?:@([a-z0-9][a-z0-9._-]*)\/)?([a-z0-9][a-z0-9._-]*)@(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const EXACT_PYTHON_PACKAGE =
  /^[A-Za-z0-9][A-Za-z0-9._-]*==(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const NPM_RUNNERS = new Set(["npx", "npm", "pnpm", "pnpx", "yarn", "bun", "bunx"]);
const PYTHON_RUNNERS = new Set(["uvx", "pipx"]);

const SECRET_KEY_PATTERN =
  /(?:^|_)(?:api[_-]?key|auth|authorization|credential|password|private[_-]?key|secret|token)(?:$|_)/i;

const DANGEROUS_VALUE_PATTERNS = [
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
  /[Bb]earer\s+[A-Za-z0-9_.~+\/-]{10,}/,
  /AKIA[0-9A-Z]{16}/,
];

const ENV_REF_PATTERN = /^\$\{([A-Z][A-Z0-9_]*)\}$|^\$([A-Z][A-Z0-9_]*)$/;
const ENV_EXTRACT_PATTERN = /\$\{([A-Z][A-Z0-9_]*)\}|\$([A-Z][A-Z0-9_]*)/g;

const KNOWN_FLAGS = new Set(["-y", "--yes", "-g", "--global", "--"]);

/**
 * Find the package argument in args, skipping known flags.
 */
function packageArgument(args) {
  for (const value of args) {
    if (KNOWN_FLAGS.has(value)) continue;
    if (value.startsWith("-")) continue;
    if (value.startsWith("@") ? value.includes("/", 1) : /^[a-z0-9]/i.test(value)) {
      return value;
    }
  }
  return undefined;
}

/**
 * Walk all string values in obj, calling cb(jsonPath, value).
 */
function walkStrings(obj, path, cb) {
  if (typeof obj === "string") {
    cb(path, obj);
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      walkStrings(obj[i], `${path}[${i}]`, cb);
    }
  } else if (obj != null && typeof obj === "object") {
    for (const [key, val] of Object.entries(obj)) {
      walkStrings(val, `${path}.${key}`, cb);
    }
  }
}

/**
 * Validate all .mcp.json files below pluginDir.
 *
 * @param {string} root - absolute repository root (for relative path display)
 * @param {string} pluginDir - absolute plugin directory to scan
 * @returns {Promise<{ diagnostics: import('./diagnostic.mjs').Diagnostic[], checkedFiles: number, environmentVariables: string[] }>}
 */
export async function validateMcpConfigurations(root, pluginDir) {
  const diagnostics = [];
  let checkedFiles = 0;
  const envVars = new Set();

  const files = await findFiles(pluginDir);
  const mcpFiles = files.filter((f) => f === ".mcp.json" || f.endsWith("/.mcp.json"));

  /** @type {Map<string, string>} server name → first file that declared it */
  const seenNames = new Map();

  for (const relToPlugin of mcpFiles) {
    const absFile = resolve(pluginDir, relToPlugin);
    const relFile = relative(root, absFile);
    checkedFiles++;

    const { data, error } = await readJson(absFile, relFile);
    if (error) {
      diagnostics.push(
        diagnostic(relFile, "JSON_PARSE", error, `Ensure ${relFile} is valid JSON.`),
      );
      continue;
    }

    // Top-level shape: must be { mcpServers: { ... } }
    if (
      data == null ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      data.mcpServers == null ||
      typeof data.mcpServers !== "object" ||
      Array.isArray(data.mcpServers)
    ) {
      diagnostics.push(
        diagnostic(
          relFile,
          "MCP_SHAPE",
          `${relFile} must have a top-level "mcpServers" object.`,
          `Wrap server definitions inside { "mcpServers": { ... } }.`,
        ),
      );
      continue;
    }

    const servers = data.mcpServers;

    for (const [name, def] of Object.entries(servers)) {
      // Server name: kebab-case
      if (!KEBAB_CASE.test(name)) {
        diagnostics.push(
          diagnostic(
            relFile,
            "IDENTIFIER_FORMAT",
            `Server name "${name}" must be kebab-case.`,
            `Rename to a kebab-case identifier (lowercase letters, digits, hyphens).`,
          ),
        );
      }

      // Duplicate server name across all .mcp.json files
      if (seenNames.has(name)) {
        diagnostics.push(
          diagnostic(
            relFile,
            "MCP_DUPLICATE",
            `Server name "${name}" is already defined in ${seenNames.get(name)}.`,
            `Use a unique server name in each .mcp.json file.`,
          ),
        );
      } else {
        seenNames.set(name, relFile);
      }

      // Must be an object
      if (def == null || typeof def !== "object" || Array.isArray(def)) {
        diagnostics.push(
          diagnostic(
            relFile,
            "MCP_SHAPE",
            `Server "${name}" must be an object.`,
            `Define "${name}" as a JSON object with required transport fields.`,
          ),
        );
        continue;
      }

      // Transport type
      const transport = def.type;
      if (typeof transport !== "string" || !SUPPORTED_MCP_TRANSPORTS.has(transport)) {
        diagnostics.push(
          diagnostic(
            relFile,
            "MCP_TRANSPORT",
            `Server "${name}" has unsupported transport type "${transport}".`,
            `Use one of: ${[...SUPPORTED_MCP_TRANSPORTS].join(", ")}.`,
          ),
        );
        continue;
      }

      const isLocal = transport === "local" || transport === "stdio";
      const isRemote = transport === "http" || transport === "sse";

      if (isLocal) {
        // command required
        if (typeof def.command !== "string" || def.command.length === 0) {
          diagnostics.push(
            diagnostic(relFile, "MCP_SHAPE", `Server "${name}" requires a nonempty "command" string.`, `Add a "command" field.`),
          );
        }

        // args: optional string array
        if (def.args !== undefined) {
          if (!Array.isArray(def.args) || !def.args.every((a) => typeof a === "string")) {
            diagnostics.push(
              diagnostic(relFile, "MCP_SHAPE", `Server "${name}" "args" must be an array of strings.`, `Fix the "args" field.`),
            );
          }
        }

        // env: optional string-to-string
        if (def.env !== undefined) {
          if (
            def.env == null ||
            typeof def.env !== "object" ||
            Array.isArray(def.env) ||
            !Object.values(def.env).every((v) => typeof v === "string")
          ) {
            diagnostics.push(
              diagnostic(relFile, "MCP_SHAPE", `Server "${name}" "env" must be a string-to-string object.`, `Fix the "env" field.`),
            );
          }
        }

        // Package pin check
        if (typeof def.command === "string" && Array.isArray(def.args)) {
          const cmd = basename(def.command);
          const isNpm = NPM_RUNNERS.has(cmd);
          const isPython = PYTHON_RUNNERS.has(cmd);

          if (isNpm || isPython) {
            const pkg = packageArgument(def.args);
            const pattern = isNpm ? EXACT_PACKAGE : EXACT_PYTHON_PACKAGE;
            if (pkg === undefined || !pattern.test(pkg)) {
              const display = pkg !== undefined ? pkg : "(none)";
              diagnostics.push(
                diagnostic(
                  relFile,
                  "MCP_PACKAGE_PIN",
                  `Server "${name}" must use an exact version-pinned package (got "${display}").`,
                  `Pin to an exact version, e.g. package@1.2.3.`,
                ),
              );
            }
          }
        }

        // Reject remote-only fields
        if (def.url !== undefined) {
          diagnostics.push(
            diagnostic(relFile, "MCP_SHAPE", `Server "${name}" (${transport}) must not have "url".`, `Remove "url" from local server.`),
          );
        }
        if (def.headers !== undefined) {
          diagnostics.push(
            diagnostic(relFile, "MCP_SHAPE", `Server "${name}" (${transport}) must not have "headers".`, `Remove "headers" from local server.`),
          );
        }
      }

      if (isRemote) {
        // url required, must be https
        if (typeof def.url !== "string" || !def.url.startsWith("https:")) {
          diagnostics.push(
            diagnostic(relFile, "MCP_SHAPE", `Server "${name}" requires an absolute "https:" URL.`, `Add a valid "url" field.`),
          );
        }

        // Reject local-only fields
        if (def.command !== undefined) {
          diagnostics.push(
            diagnostic(relFile, "MCP_SHAPE", `Server "${name}" (${transport}) must not have "command".`, `Remove "command" from remote server.`),
          );
        }
        if (def.args !== undefined) {
          diagnostics.push(
            diagnostic(relFile, "MCP_SHAPE", `Server "${name}" (${transport}) must not have "args".`, `Remove "args" from remote server.`),
          );
        }

        // headers: optional string-to-string
        if (def.headers !== undefined) {
          if (
            def.headers == null ||
            typeof def.headers !== "object" ||
            Array.isArray(def.headers) ||
            !Object.values(def.headers).every((v) => typeof v === "string")
          ) {
            diagnostics.push(
              diagnostic(relFile, "MCP_SHAPE", `Server "${name}" "headers" must be a string-to-string object.`, `Fix the "headers" field.`),
            );
          }
        }
      }

      // tools: optional nonempty string array
      if (def.tools !== undefined) {
        if (
          !Array.isArray(def.tools) ||
          def.tools.length === 0 ||
          !def.tools.every((t) => typeof t === "string")
        ) {
          diagnostics.push(
            diagnostic(relFile, "MCP_SHAPE", `Server "${name}" "tools" must be a nonempty array of strings.`, `Fix the "tools" field.`),
          );
        }
      }

      // Secret / credential scanning
      walkStrings(def, name, (jsonPath, value) => {
        const pathParts = jsonPath.split(".");
        const lastKey = pathParts[pathParts.length - 1].replace(/\[\d+\]$/, "");
        const inEnvOrHeaders = pathParts.some((p) => p === "env" || p === "headers");

        // Check secret-like keys
        if (SECRET_KEY_PATTERN.test(lastKey)) {
          if (value === "" && inEnvOrHeaders) {
            // empty in env/headers is ok
          } else if (ENV_REF_PATTERN.test(value)) {
            // env ref is ok
          } else if (value !== "") {
            diagnostics.push(
              diagnostic(
                relFile,
                "MCP_INLINE_SECRET",
                `Server "${name}" key "${lastKey}" at path "${jsonPath}" contains a literal secret.`,
                `Use an environment variable reference like \${MY_SECRET} instead.`,
              ),
            );
          }
        }

        // Check for dangerous value patterns regardless of key
        for (const pattern of DANGEROUS_VALUE_PATTERNS) {
          if (pattern.test(value)) {
            diagnostics.push(
              diagnostic(
                relFile,
                "MCP_INLINE_SECRET",
                `Server "${name}" at path "${jsonPath}" contains a credential-like value.`,
                `Remove hardcoded credentials and use environment variable references.`,
              ),
            );
            break;
          }
        }

        // Extract environment variable references
        let match;
        ENV_EXTRACT_PATTERN.lastIndex = 0;
        while ((match = ENV_EXTRACT_PATTERN.exec(value)) !== null) {
          envVars.add(match[1] ?? match[2]);
        }
      });
    }
  }

  const environmentVariables = [...envVars].sort();
  return { diagnostics, checkedFiles, environmentVariables };
}
