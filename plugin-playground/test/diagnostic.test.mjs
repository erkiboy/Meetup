import assert from "node:assert/strict";
import test from "node:test";
import {
  diagnostic,
  formatDiagnostic,
  sortDiagnostics,
} from "../scripts/validation/diagnostic.mjs";

test("formats actionable diagnostics", () => {
  const value = diagnostic("b.json", "RULE_B", "bad value", "replace value");
  assert.equal(
    formatDiagnostic(value),
    "b.json [RULE_B] bad value\n  Remediation: replace value",
  );
});

test("sorts diagnostics by file then rule then message", () => {
  const values = [
    diagnostic("b", "A", "z", "fix"),
    diagnostic("a", "B", "z", "fix"),
    diagnostic("a", "A", "z", "fix"),
  ];
  assert.deepEqual(sortDiagnostics(values).map(({ file, rule }) => [file, rule]), [
    ["a", "A"],
    ["a", "B"],
    ["b", "A"],
  ]);
});
