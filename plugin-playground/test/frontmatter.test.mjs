import assert from "node:assert/strict";
import test from "node:test";
import { parseSkillDocument } from "../scripts/validation/frontmatter.mjs";

const VALID_DOC = `---
name: example-skill
description: A sample skill for demonstration
---
This is the body of the skill document.
`;

test("parses valid frontmatter and body", () => {
  const result = parseSkillDocument("skills/example-skill/SKILL.md", VALID_DOC);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.frontmatter.name, "example-skill");
  assert.equal(result.frontmatter.description, "A sample skill for demonstration");
  assert.ok(result.body.trim().length > 0);
});

test("rejects missing opening delimiter", () => {
  const doc = `name: example-skill\ndescription: A skill\n---\nBody\n`;
  const result = parseSkillDocument("skills/example-skill/SKILL.md", doc);
  assert.ok(result.diagnostics.some((d) => d.rule === "SKILL_FRONTMATTER"));
});

test("rejects missing closing delimiter", () => {
  const doc = `---\nname: example-skill\ndescription: A skill\nBody\n`;
  const result = parseSkillDocument("skills/example-skill/SKILL.md", doc);
  assert.ok(result.diagnostics.some((d) => d.rule === "SKILL_FRONTMATTER"));
});

test("rejects duplicate keys", () => {
  const doc = `---\nname: example-skill\nname: duplicate\ndescription: A skill\n---\nBody\n`;
  const result = parseSkillDocument("skills/example-skill/SKILL.md", doc);
  assert.ok(result.diagnostics.some((d) => d.rule === "SKILL_FRONTMATTER"));
});

test("rejects unsupported nested values", () => {
  const doc = `---\nname: example-skill\ndescription: A skill\nnested:\n  key: value\n---\nBody\n`;
  const result = parseSkillDocument("skills/example-skill/SKILL.md", doc);
  assert.ok(result.diagnostics.some((d) => d.rule === "SKILL_FRONTMATTER"));
});

test("rejects unsupported list values", () => {
  const doc = `---\nname: example-skill\ndescription: A skill\ntags:\n- one\n- two\n---\nBody\n`;
  const result = parseSkillDocument("skills/example-skill/SKILL.md", doc);
  assert.ok(result.diagnostics.some((d) => d.rule === "SKILL_FRONTMATTER"));
});

test("rejects empty name", () => {
  const doc = `---\nname: \ndescription: A skill\n---\nBody\n`;
  const result = parseSkillDocument("skills/example-skill/SKILL.md", doc);
  assert.ok(result.diagnostics.some((d) => d.rule === "SKILL_FRONTMATTER"));
});

test("rejects empty description", () => {
  const doc = `---\nname: example-skill\ndescription: \n---\nBody\n`;
  const result = parseSkillDocument("skills/example-skill/SKILL.md", doc);
  assert.ok(result.diagnostics.some((d) => d.rule === "SKILL_FRONTMATTER"));
});

test("rejects empty body", () => {
  const doc = `---\nname: example-skill\ndescription: A skill\n---\n`;
  const result = parseSkillDocument("skills/example-skill/SKILL.md", doc);
  assert.ok(result.diagnostics.some((d) => d.rule === "SKILL_FRONTMATTER"));
});
