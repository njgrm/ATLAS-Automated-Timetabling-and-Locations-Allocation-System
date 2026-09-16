#!/usr/bin/env node
// ops/workflow/deps.mjs
// Dependency-tree identity by LF-normalized `package-lock.json` SHA-256
// (WF-C10 section 3.6).
//
//   node ops/workflow/deps.mjs identity <path>
//   node ops/workflow/deps.mjs compare <a> <b>
//
// Exit codes: 0 equal / identity resolved, 1 different or unreadable,
// 2 usage error. The identity is the LF-normalized hash because a raw checkout
// can rewrite LF to CRLF and a byte-for-byte compare then reports a false
// mismatch, which is exactly the defect this command removes.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { lfSha256 } from "./lib/util.mjs";

function emit(report) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function fail(code, message, errPath = "$") {
  return {
    status: "fail",
    summary: { errors: 1, operation: null, paths: [] },
    nextActions: [],
    artifacts: [],
    errors: [{ code, message, path: errPath }],
  };
}

function identityOf(filePath) {
  const abs = path.resolve(filePath);
  let bytes;
  try {
    bytes = fs.readFileSync(abs);
  } catch (err) {
    return { ok: false, message: `cannot read ${abs}: ${err.message}` };
  }
  return { ok: true, abs, bytes: bytes.length, sha256: lfSha256(bytes) };
}

const argv = process.argv.slice(2);
const op = argv[0];

if (op === "identity") {
  if (argv.length !== 2) {
    emit(fail("USAGE_MISSING_PATH", "identity requires exactly one positional <path>"));
    process.exit(2);
  }
  const result = identityOf(argv[1]);
  if (!result.ok) {
    emit(fail("DEPS_UNREADABLE", result.message, argv[1]));
    process.exit(1);
  }
  emit({
    status: "ok",
    summary: { operation: "identity", path: result.abs, sha256: result.sha256, bytes: result.bytes },
    nextActions: [],
    artifacts: [{ path: result.abs, sha256: result.sha256 }],
    errors: [],
  });
  process.exit(0);
}

if (op === "compare") {
  if (argv.length !== 3) {
    emit(fail("USAGE_MISSING_PATH", "compare requires exactly two positional <path> arguments"));
    process.exit(2);
  }
  const left = identityOf(argv[1]);
  const right = identityOf(argv[2]);
  if (!left.ok || !right.ok) {
    const broken = !left.ok ? argv[1] : argv[2];
    emit(fail("DEPS_UNREADABLE", (!left.ok ? left : right).message, broken));
    process.exit(1);
  }
  const equal = left.sha256 === right.sha256;
  const report = {
    status: equal ? "ok" : "fail",
    summary: {
      operation: "compare",
      left: { path: left.abs, sha256: left.sha256 },
      right: { path: right.abs, sha256: right.sha256 },
      equal,
    },
    nextActions: [],
    artifacts: [],
    errors: equal
      ? []
      : [
          {
            code: "DEPS_IDENTITY_DIFFERENT",
            message: `LF-normalized lockfile identity differs: ${left.sha256} != ${right.sha256}`,
            path: "$.compare",
          },
        ],
  };
  emit(report);
  process.exit(equal ? 0 : 1);
}

emit(fail("USAGE_UNKNOWN_OP", `the operations are "identity" and "compare"; got ${JSON.stringify(op)}`));
process.exit(2);
