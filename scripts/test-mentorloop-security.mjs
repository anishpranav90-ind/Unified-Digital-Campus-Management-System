import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function loadTypeScriptModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const auth = await loadTypeScriptModule("../src/lib/auth/institutional-email.ts");
const proof = await loadTypeScriptModule("../src/lib/mentorloop/activity-csv.ts");

test("institutional email matching is case-insensitive and exact-domain only", () => {
  const previous = process.env.INSTITUTIONAL_EMAIL_DOMAINS;
  process.env.INSTITUTIONAL_EMAIL_DOMAINS = "college.edu.in";
  try {
    assert.equal(auth.isInstitutionalEmail("Student@College.edu.in"), true);
    assert.equal(auth.isInstitutionalEmail("student@college.edu.in.attacker.com"), false);
    assert.equal(auth.isInstitutionalEmail("student@other.edu.in"), false);
    assert.equal(auth.isInstitutionalEmail("college.edu.in"), false);
  } finally {
    if (previous === undefined) delete process.env.INSTITUTIONAL_EMAIL_DOMAINS;
    else process.env.INSTITUTIONAL_EMAIL_DOMAINS = previous;
  }
});

test("institutional email configuration accepts explicit comma-separated domains", () => {
  const previous = process.env.INSTITUTIONAL_EMAIL_DOMAINS;
  process.env.INSTITUTIONAL_EMAIL_DOMAINS = " college.edu.in, sjce.ac.in ";
  try {
    assert.equal(auth.isInstitutionalEmail("student@sjce.ac.in"), true);
    assert.equal(auth.isInstitutionalEmail("student@unlisted.ac.in"), false);
  } finally {
    if (previous === undefined) delete process.env.INSTITUTIONAL_EMAIL_DOMAINS;
    else process.env.INSTITUTIONAL_EMAIL_DOMAINS = previous;
  }
});

test("default allowlist accepts common consumer providers", () => {
  const previous = process.env.INSTITUTIONAL_EMAIL_DOMAINS;
  delete process.env.INSTITUTIONAL_EMAIL_DOMAINS;
  try {
    assert.equal(auth.isInstitutionalEmail("student@gmail.com"), true);
    assert.equal(auth.isInstitutionalEmail("student@yahoo.com"), true);
    assert.equal(auth.isInstitutionalEmail("student@college.edu.in"), true);
    assert.equal(auth.isInstitutionalEmail("student@gmail.com.attacker.com"), false);
  } finally {
    if (previous === undefined) delete process.env.INSTITUTIONAL_EMAIL_DOMAINS;
    else process.env.INSTITUTIONAL_EMAIL_DOMAINS = previous;
  }
});

test("proof links require public HTTPS URLs without embedded credentials", () => {
  assert.equal(proof.normalizeSafeProofUrl("https://docs.google.com/document/d/123"), "https://docs.google.com/document/d/123");
  assert.equal(proof.normalizeSafeProofUrl("javascript:alert(1)"), null);
  assert.equal(proof.normalizeSafeProofUrl("https://user:pass@example.com/proof"), null);
  assert.equal(proof.normalizeSafeProofUrl("https://localhost/proof"), null);
  assert.equal(proof.normalizeSafeProofUrl("https://192.168.1.1/proof"), null);
});
