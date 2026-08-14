/**
 * @typedef {{ file: string, rule: string, message: string, remediation: string }} Diagnostic
 */

/**
 * @param {string} file
 * @param {string} rule
 * @param {string} message
 * @param {string} remediation
 * @returns {Diagnostic}
 */
export function diagnostic(file, rule, message, remediation) {
  return { file, rule, message, remediation };
}

/**
 * @param {Diagnostic} d
 * @returns {string}
 */
export function formatDiagnostic(d) {
  return `${d.file} [${d.rule}] ${d.message}\n  Remediation: ${d.remediation}`;
}

/**
 * @param {Diagnostic[]} diagnostics
 * @returns {Diagnostic[]}
 */
export function sortDiagnostics(diagnostics) {
  return [...diagnostics].sort((a, b) => {
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
    if (a.message !== b.message) return a.message < b.message ? -1 : 1;
    return 0;
  });
}
