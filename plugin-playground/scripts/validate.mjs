#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatDiagnostic } from "./validation/diagnostic.mjs";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(process.argv[2] ?? defaultRoot);

try {
  const { validateRepository } = await import("./validation/repository.mjs");
  const result = await validateRepository(root);
  if (result.diagnostics.length === 0) {
    console.log(`Validation passed (${result.checkedFiles} files checked).`);
  } else {
    for (const value of result.diagnostics) console.error(formatDiagnostic(value));
    console.error(
      `Validation failed with ${result.diagnostics.length} ${
        result.diagnostics.length === 1 ? "error" : "errors"
      }.`,
    );
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Validation crashed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
