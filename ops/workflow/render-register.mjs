#!/usr/bin/env node
// ops/workflow/render-register.mjs
// Render the deterministic Markdown register from the validated state document.
// On invalid state: exit 1 and never create/modify the output file.
//
// `--check` (boolean) verifies that the existing output already equals the
// deterministic render without writing anything: exit 0 when byte-identical,
// exit 1 with RENDER_CHECK_MISMATCH when it differs or is missing.
import fs from "node:fs";
import process from "node:process";
import path from "node:path";
import { parseArgs } from "./lib/args.mjs";
import { verifyStateDocument, buildReport } from "./lib/verify.mjs";
import { renderRegister } from "./lib/render.mjs";
import { writeFileAtomicSync } from "./lib/util.mjs";

function emit(report) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function usageReport(parsed) {
  return {
    status: "fail",
    summary: { streams: { total: 0, byState: {} }, errors: 1, statePath: null, stateSha256: null },
    nextActions: [],
    artifacts: [],
    errors: [{ code: parsed.code, message: parsed.message, path: "$" }],
  };
}

const rawArgs = process.argv.slice(2);
const checkIndex = rawArgs.indexOf("--check");
const checkMode = checkIndex !== -1;
if (checkMode) rawArgs.splice(checkIndex, 1);

const parsed = parseArgs(rawArgs, { required: ["state", "output"], optional: [] });
if (!parsed.ok) {
  emit(usageReport(parsed));
  process.exit(2);
}

const result = verifyStateDocument(parsed.values.state);
if (!result.ok) {
  emit(buildReport(result));
  process.exit(1);
}

const markdown = renderRegister(result.doc, result.stateSha256);
const outputPath = path.resolve(parsed.values.output);

if (checkMode) {
  let existing = null;
  try {
    existing = fs.readFileSync(outputPath);
  } catch {
    existing = null;
  }
  const expected = Buffer.from(markdown, "utf8");
  if (existing !== null && existing.equals(expected)) {
    emit(buildReport(result));
    process.exit(0);
  }
  emit({
    ...buildReport(result),
    status: "fail",
    errors: [{ code: "RENDER_CHECK_MISMATCH", message: `existing ${parsed.values.output} does not match the deterministic render`, path: parsed.values.output }],
  });
  process.exit(1);
}

writeFileAtomicSync(outputPath, Buffer.from(markdown, "utf8"));
emit(buildReport(result));
process.exit(0);
