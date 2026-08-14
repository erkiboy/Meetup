import { cp, mkdir, rm, readdir } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");
const VALID_DIR = join(FIXTURES_DIR, "valid");

/**
 * Recursively collect relative file paths under dir, sorted.
 * @param {string} dir
 * @param {string} [base]
 * @returns {Promise<string[]>}
 */
async function collectRelPaths(dir, base) {
  base = base ?? dir;
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await collectRelPaths(abs, base);
      results.push(...sub);
    } else {
      results.push(abs.slice(base.length + 1));
    }
  }
  return results.sort();
}

/**
 * Run a test against a temporary fixture directory.
 * - Copies test/fixtures/valid to a temp dir.
 * - For invalid fixtures, walks the overlay in sorted order:
 *     - `.delete` suffix → removes the target
 *     - otherwise → copies replacement over target
 * @param {string} name - fixture name ("valid" or an invalid overlay)
 * @param {(root: string) => Promise<void>} callback
 */
export async function withFixture(name, callback) {
  const root = await mkdtemp(join(tmpdir(), "plugin-playground-"));
  try {
    // Copy valid baseline
    await cp(VALID_DIR, root, { recursive: true });

    if (name !== "valid") {
      const overlayDir = join(FIXTURES_DIR, name);
      const overlayPaths = await collectRelPaths(overlayDir);
      for (const rel of overlayPaths) {
        if (rel.endsWith(".delete")) {
          // Remove the target (strip .delete suffix)
          const target = join(root, rel.slice(0, -".delete".length));
          await rm(target, { recursive: true, force: true });
        } else {
          const target = join(root, rel);
          await mkdir(dirname(target), { recursive: true });
          await cp(join(overlayDir, rel), target);
        }
      }
    }

    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
