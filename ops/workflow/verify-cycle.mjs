#!/usr/bin/env node
// ops/workflow/verify-cycle.mjs
// Validate the authoritative cycle-state document. Never falls back to any
// default state file. Optionally mint a closure receipt on success.
import process from "node:process";
import path from "node:path";
import { parseArgs } from "./lib/args.mjs";
import { verifyStateDocument, buildReport } from "./lib/verify.mjs";
import { selectReceiptStream, mintReceipt } from "./lib/receipt.mjs";

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

function overrideErrors(result, code, message) {
  const report = buildReport(result);
  return {
    ...report,
    status: "fail",
    summary: { ...report.summary, errors: 1 },
    errors: [{ code, message, path: "$" }],
  };
}

const parsed = parseArgs(process.argv.slice(2), { required: ["state"], optional: ["receipt", "stream"] });
if (!parsed.ok) {
  emit(usageReport(parsed));
  process.exit(2);
}

const statePath = parsed.values.state;
if (parsed.values.stream !== undefined && parsed.values.receipt === undefined) {
  emit(usageReport({ code: "USAGE_STREAM_REQUIRES_RECEIPT", message: 'flag "--stream" is only meaningful together with "--receipt"' }));
  process.exit(2);
}
const result = verifyStateDocument(statePath);

if (parsed.values.receipt !== undefined) {
  if (!result.ok) {
    emit(buildReport(result));
    process.exit(1);
  }
  const selection = selectReceiptStream(result.doc, parsed.values.stream);
  if (!selection.ok) {
    emit(overrideErrors(result, selection.code, selection.message));
    process.exit(1);
  }
  try {
    mintReceipt(path.resolve(parsed.values.receipt), selection.stream, statePath, result.stateBytes);
  } catch (err) {
    emit(overrideErrors(result, "RECEIPT_WRITE_FAILED", `could not write receipt: ${err.message}`));
    process.exit(1);
  }
  emit(buildReport(result));
  process.exit(0);
}

emit(buildReport(result));
process.exit(result.ok ? 0 : 1);
