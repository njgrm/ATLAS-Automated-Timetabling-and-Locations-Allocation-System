#!/usr/bin/env node
// ops/workflow/render-register.mjs
// Render the deterministic Markdown register from the validated state document.
// On invalid state: exit 1 and never create/modify the output file.
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

const parsed = parseArgs(process.argv.slice(2), { required: ["state", "output"], optional: [] });
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
writeFileAtomicSync(path.resolve(parsed.values.output), Buffer.from(markdown, "utf8"));
emit(buildReport(result));
process.exit(0);
