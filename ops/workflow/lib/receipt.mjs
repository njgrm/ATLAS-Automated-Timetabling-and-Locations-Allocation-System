// ops/workflow/lib/receipt.mjs
// Cycle-closure receipt: strict shape, fact attestation, atomic mint.
import fs from "node:fs";
import path from "node:path";
import { sha256Hex, writeFileAtomicSync } from "./util.mjs";
import { isPlainObject, deepEqual } from "./schema.mjs";

export const RECEIPT_VERSION = "1.0.0";
export const SUPPORTED_RECEIPT_VERSIONS = new Set([RECEIPT_VERSION]);

export function receiptPathFor(closureEntry, repoRoot, stateDir) {
  const base = repoRoot ? repoRoot : stateDir;
  return path.resolve(base, closureEntry.path.split("/").join(path.sep));
}

export function validateReceiptShape(receipt) {
  const problems = [];
  if (!isPlainObject(receipt)) return ["receipt is not an object"];
  const allowed = new Set(["receiptVersion", "generatedAt", "statePath", "stateSha256", "status", "streamId", "verified"]);
  for (const key of Object.keys(receipt)) {
    if (!allowed.has(key)) problems.push(`unexpected receipt field "${key}"`);
  }
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(receipt, key)) problems.push(`missing receipt field "${key}"`);
  }
  if (typeof receipt.receiptVersion !== "string") problems.push("receiptVersion must be a string");
  if (typeof receipt.generatedAt !== "string") problems.push("generatedAt must be a string");
  if (typeof receipt.statePath !== "string" || receipt.statePath.length === 0) problems.push("statePath must be a non-empty string");
  if (typeof receipt.stateSha256 !== "string" || !/^[0-9a-f]{64}$/.test(receipt.stateSha256)) problems.push("stateSha256 must be 64-hex");
  if (typeof receipt.status !== "string") problems.push("status must be a string");
  if (typeof receipt.streamId !== "string" || receipt.streamId.length === 0) problems.push("streamId must be a non-empty string");
  const verified = receipt.verified;
  if (!isPlainObject(verified)) {
    problems.push("verified must be an object");
    return problems;
  }
  const verifiedKeys = new Set(["candidateSha", "integrationSha", "qaVerdict", "auditorVerdict", "gates", "artifacts"]);
  for (const key of Object.keys(verified)) {
    if (!verifiedKeys.has(key)) problems.push(`unexpected verified field "${key}"`);
  }
  for (const key of verifiedKeys) {
    if (!Object.prototype.hasOwnProperty.call(verified, key)) problems.push(`missing verified field "${key}"`);
  }
  if (!isPlainObject(verified.gates)) {
    problems.push("verified.gates must be an object");
  } else {
    for (const key of ["total", "passed", "failed", "blocked", "unperformed"]) {
      if (typeof verified.gates[key] !== "number" || !Number.isInteger(verified.gates[key]) || verified.gates[key] < 0) {
        problems.push(`verified.gates.${key} must be a non-negative integer`);
      }
    }
  }
  if (!Array.isArray(verified.artifacts)) {
    problems.push("verified.artifacts must be an array");
  } else {
    verified.artifacts.forEach((entry, i) => {
      if (!isPlainObject(entry) || typeof entry.path !== "string" || typeof entry.sha256 !== "string") {
        problems.push(`verified.artifacts[${i}] must have string path and sha256`);
      }
    });
  }
  return problems;
}

export function validateClosureReceipt(stream, repoRoot, stateDir) {
  const closure = stream.closure;
  if (!closure || !closure.receipt) {
    return { code: "COMPLETE_MISSING_RECEIPT", message: "COMPLETE stream has no closure.receipt" };
  }
  const filePath = receiptPathFor(closure.receipt, repoRoot, stateDir);
  let bytes;
  try {
    bytes = fs.readFileSync(filePath);
  } catch (err) {
    return {
      code: "COMPLETE_MISSING_RECEIPT",
      message: `receipt file ${closure.receipt.path} is missing: ${err.message}`,
    };
  }
  const actualSha = sha256Hex(bytes);
  if (actualSha !== closure.receipt.sha256) {
    return {
      code: "RECEIPT_INVALID",
      message: `receipt sha256 pin ${closure.receipt.sha256} does not match file ${actualSha}`,
    };
  }
  let receipt;
  try {
    receipt = JSON.parse(bytes.toString("utf8"));
  } catch (err) {
    return { code: "RECEIPT_INVALID", message: `receipt is not valid JSON: ${err.message}` };
  }
  const shapeProblems = validateReceiptShape(receipt);
  if (shapeProblems.length > 0) {
    return { code: "RECEIPT_INVALID", message: `receipt shape invalid: ${shapeProblems.join("; ")}` };
  }
  if (!SUPPORTED_RECEIPT_VERSIONS.has(receipt.receiptVersion)) {
    return { code: "RECEIPT_INVALID", message: `unsupported receiptVersion ${receipt.receiptVersion}` };
  }
  if (receipt.status !== "ok") {
    return { code: "RECEIPT_INVALID", message: `receipt status is ${receipt.status}, expected "ok"` };
  }
  if (receipt.streamId !== stream.id) {
    return { code: "RECEIPT_INVALID", message: `receipt streamId ${receipt.streamId} != ${stream.id}` };
  }
  const factsMatch =
    receipt.verified.candidateSha === stream.git.candidateSha &&
    receipt.verified.integrationSha === stream.git.integrationSha &&
    receipt.verified.qaVerdict === stream.review.qaVerdict &&
    receipt.verified.auditorVerdict === stream.review.auditorVerdict &&
    deepEqual(receipt.verified.gates, stream.gates);
  if (!factsMatch) {
    return { code: "RECEIPT_STALE", message: "receipt attests facts that differ from the current stream facts" };
  }
  return null;
}

export function selectReceiptStream(doc, requestedStreamId) {
  const streams = Array.isArray(doc.streams) ? doc.streams : [];
  if (requestedStreamId !== undefined && requestedStreamId !== null) {
    const found = streams.find((s) => s.id === requestedStreamId);
    if (!found) {
      return { ok: false, code: "RECEIPT_STREAM_UNKNOWN", message: `stream ${requestedStreamId} not found` };
    }
    return { ok: true, stream: found };
  }
  const complete = streams.filter((s) => s.state === "COMPLETE");
  if (complete.length === 1) return { ok: true, stream: complete[0] };
  const accepted = streams.filter((s) => s.review && s.review.qaVerdict === "ACCEPT_READY");
  if (accepted.length === 1) return { ok: true, stream: accepted[0] };
  return {
    ok: false,
    code: "RECEIPT_STREAM_AMBIGUOUS",
    message: `cannot select a unique attested stream (COMPLETE=${complete.length}, ACCEPT_READY=${accepted.length}); pass --stream <id>`,
  };
}

export function buildReceipt(stream, statePathAsGiven, stateBytes) {
  return {
    receiptVersion: RECEIPT_VERSION,
    generatedAt: new Date().toISOString(),
    statePath: statePathAsGiven,
    stateSha256: sha256Hex(stateBytes),
    status: "ok",
    streamId: stream.id,
    verified: {
      candidateSha: stream.git.candidateSha,
      integrationSha: stream.git.integrationSha,
      qaVerdict: stream.review.qaVerdict,
      auditorVerdict: stream.review.auditorVerdict,
      gates: {
        total: stream.gates.total,
        passed: stream.gates.passed,
        failed: stream.gates.failed,
        blocked: stream.gates.blocked,
        unperformed: stream.gates.unperformed,
      },
      artifacts: stream.artifacts.map((a) => ({ path: a.path, sha256: a.sha256 })),
    },
  };
}

export function mintReceipt(receiptPath, stream, statePathAsGiven, stateBytes) {
  const receipt = buildReceipt(stream, statePathAsGiven, stateBytes);
  writeFileAtomicSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}
