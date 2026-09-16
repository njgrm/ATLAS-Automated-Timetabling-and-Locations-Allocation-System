#!/usr/bin/env node
// ops/workflow/transition.mjs
// CLI for the atomic delivery-cycle state transitions (A2).
//
//   node ops/workflow/transition.mjs --transition <name> --state <path> \
//     --expect-revision <n> [--stream <id>] [--render <path>] [--now <iso>] \
//     [transition-specific flags]
//
//   create-stream additionally takes exactly one --stream-spec <path> (a single
//   schema-complete stream record) and --observed-origin-main <40-hex tip>.
//
// Exactly one JSON object is printed: status, summary, nextActions, artifacts,
// errors. Exit codes: 0 ok, 1 transition/verification failure, 2 usage error.
// A repeated flag is a usage error (USAGE_DUPLICATE_FLAG) rather than a silent
// last-one-wins override.
import process from "node:process";
import { listTransitions, runTransition, TRANSITIONS } from "./lib/transition.mjs";

const BASE_FLAGS = new Set(["transition", "state", "expect-revision", "stream", "render", "by", "now", "active-window-ms"]);
const ALL_ALLOWED = new Set(BASE_FLAGS);
for (const spec of Object.values(TRANSITIONS)) {
  for (const name of [...(spec.required || []), ...(spec.optional || [])]) ALL_ALLOWED.add(name);
}

// `--now` and `--active-window-ms` drive the liveness verdict, so a malformed
// value is a usage error (exit 2) rather than a silent fallback to the wall
// clock and the default window.
const ISO_ARG_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function emit(report) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function usageReport(code, message) {
  return {
    status: "fail",
    summary: { transition: null, statePath: null },
    nextActions: [],
    artifacts: [],
    errors: [{ code, message, path: "$" }],
  };
}

function parse(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) return { ok: false, code: "USAGE_UNEXPECTED_ARGUMENT", message: `unexpected argument "${token}"` };
    const name = token.slice(2);
    if (!ALL_ALLOWED.has(name)) return { ok: false, code: "USAGE_UNKNOWN_FLAG", message: `unknown flag "${token}"` };
    // A repeated flag is ambiguous input: reject it instead of letting the last
    // occurrence silently win (an operator cannot tell which value was used).
    if (Object.prototype.hasOwnProperty.call(values, name)) {
      return { ok: false, code: "USAGE_DUPLICATE_FLAG", message: `flag "${token}" was provided more than once` };
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      // Empty values are meaningful only for explicitly nullable lease fields.
      if (["lease-session", "lease-expires", "lease-worktree"].includes(name)) {
        values[name] = "";
        continue;
      }
      return { ok: false, code: `USAGE_MISSING_VALUE_${name.toUpperCase().replace(/-/g, "_")}`, message: `flag "${token}" requires a value` };
    }
    values[name] = next;
    i += 1;
  }
  return { ok: true, values };
}

const parsed = parse(process.argv.slice(2));
if (!parsed.ok) {
  emit(usageReport(parsed.code, parsed.message));
  process.exit(2);
}
const flags = parsed.values;
if (!flags.transition) {
  emit(usageReport("USAGE_MISSING_TRANSITION", `missing required flag "--transition" (known: ${listTransitions().join(", ")})`));
  process.exit(2);
}
if (!flags.state) {
  emit(usageReport("USAGE_MISSING_STATE", 'missing required flag "--state"'));
  process.exit(2);
}
if (!flags["expect-revision"]) {
  emit(usageReport("USAGE_MISSING_EXPECT_REVISION", 'missing required flag "--expect-revision"'));
  process.exit(2);
}
if (flags.now !== undefined && !ISO_ARG_RE.test(flags.now)) {
  emit(usageReport("USAGE_INVALID_NOW", `--now must be an ISO-8601 timestamp, got "${flags.now}"`));
  process.exit(2);
}
if (flags["active-window-ms"] !== undefined) {
  const windowMs = Number(flags["active-window-ms"]);
  if (!Number.isInteger(windowMs) || windowMs <= 0) {
    emit(usageReport("USAGE_INVALID_ACTIVE_WINDOW", `--active-window-ms must be a positive integer, got "${flags["active-window-ms"]}"`));
    process.exit(2);
  }
}
// `create-stream` introduces two required flags whose absence is a usage error
// (exit 2) rather than a transition failure, matching the base flags above.
if (flags.transition === "create-stream") {
  for (const name of TRANSITIONS["create-stream"].required) {
    if (flags[name] === undefined || flags[name] === "") {
      emit(usageReport(`USAGE_MISSING_${name.toUpperCase().replace(/-/g, "_")}`, `missing required flag "--${name}" for transition create-stream`));
      process.exit(2);
    }
  }
}

const report = runTransition({ statePath: flags.state, transitionName: flags.transition, flags, now: flags.now || null });
emit(report);
process.exit(report.status === "ok" ? 0 : 1);
