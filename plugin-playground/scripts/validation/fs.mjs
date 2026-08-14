import { readFile, access } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Check whether a path exists (any kind).
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a UTF-8 text file, returning null if not found.
 * @param {string} filePath
 * @returns {Promise<string|null>}
 */
export async function readText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * Read and parse a JSON file. Returns { data, error } where error contains a message
 * without exposing absolute paths.
 * @param {string} filePath
 * @param {string} relPath - relative path to use in error messages
 * @returns {Promise<{ data: unknown, error: string|null }>}
 */
export async function readJson(filePath, relPath) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (err) {
    return { data: null, error: `${relPath}: file not found or unreadable` };
  }
  try {
    return { data: JSON.parse(text), error: null };
  } catch (err) {
    return { data: null, error: `${relPath}: ${err.message}` };
  }
}

/**
 * Recursively find all files under dir. Returns sorted POSIX-relative paths.
 * @param {string} dir - absolute directory to search
 * @param {string} base - base for relative paths (defaults to dir)
 * @returns {Promise<string[]>}
 */
export async function findFiles(dir, base) {
  base = base ?? dir;
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await findFiles(abs, base);
      results.push(...sub);
    } else {
      const rel = path.relative(base, abs).split(path.sep).join("/");
      results.push(rel);
    }
  }
  return results.sort();
}
