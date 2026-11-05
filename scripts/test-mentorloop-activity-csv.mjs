import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/mentorloop/activity-csv.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const csv = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const header = "student_email,category,activity_type,title,source,source_record_id,occurred_at,proof_url";

test("parses a staff-imported activity record and normalizes its email and timestamp", () => {
  const result = csv.parseMentorActivityCsv(
    `${header}\r\nSTUDENT@example.edu,tech,hackathon_registration,Campus Hack,Google Sheet,reg-1,2026-10-15T10:00:00Z,https://example.edu/proof`,
  );
  assert.equal(result.ok, true);
  assert.equal(result.records[0].student_email, "student@example.edu");
  assert.equal(result.records[0].occurred_at, "2026-10-15T10:00:00.000Z");
  assert.equal(result.records[0].activity_type, "hackathon_registration");
});

test("supports commas and escaped quotes inside CSV fields", () => {
  const result = csv.parseMentorActivityCsv(
    `${header}\nstudent@example.edu,research,paper_publication,"A paper, ""quoted""",Crossref,doi-1,2026-10-15,`,
  );
  assert.equal(result.ok, true);
  assert.equal(result.records[0].title, 'A paper, "quoted"');
  assert.equal(result.records[0].proof_url, null);
});

test("rejects unknown categories and non-HTTPS proof links", () => {
  const category = csv.parseMentorActivityCsv(
    `${header}\nstudent@example.edu,other,hackathon_registration,Campus Hack,Google Sheet,reg-1,2026-10-15,`,
  );
  assert.equal(category.ok, false);
  const proof = csv.parseMentorActivityCsv(
    `${header}\nstudent@example.edu,tech,hackathon_registration,Campus Hack,Google Sheet,reg-1,2026-10-15,http://example.edu/proof`,
  );
  assert.equal(proof.ok, false);
});

test("rejects duplicate source record IDs for the same student", () => {
  const row = "student@example.edu,tech,hackathon_registration,Campus Hack,Google Sheet,reg-1,2026-10-15,";
  const result = csv.parseMentorActivityCsv(`${header}\n${row}\n${row}`);
  assert.equal(result.ok, false);
  assert.match(result.error, /duplicates/i);
});
