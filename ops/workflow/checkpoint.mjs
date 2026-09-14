#!/usr/bin/env node
// ops/workflow/checkpoint.mjs
// Emit the minimal compaction checkpoint for one stream from the authoritative
// state document. This is the production surface a role uses to recover after
// OpenCode compaction: it reads machine state, never chat transcripts.
//
//   node ops/workflow/checkpoint.mjs --state <path> --stream <id> \
//     [--role <role>] [--lease <id>] [--directive <hash>] [--last-gate <text>] \
//     [--boundaries <a|b|c>] [--pending-approval <text>]
//
// Exit codes: 0 ok, 1 state/checkpoint failure, 2 usage error.
import process from "node:process";
import { parseArgs } from "./lib/args.mjs";
import { verifyStateDocument, buildReport } from "./lib/verify.mjs";
import { buildCheckpoint, CheckpointError } from "./lib/checkpoint.mjs";

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

const parsed = parseArgs(process.argv.slice(2), {
  required: ["state", "stream"],
  optional: ["role", "lease", "directive", "last-gate", "boundaries", "pending-approval"],
});
if (!parsed.ok) {
  emit(usageReport(parsed));
  process.exit(2);
}

const result = verifyStateDocument(parsed.values.state);
if (!result.ok) {
  emit(buildReport(result));
  process.exit(1);
}

const stream = result.doc.streams.find((s) => s.id === parsed.values.stream);
if (!stream) {
  emit({
    ...buildReport(result),
    status: "fail",
    errors: [{ code: "CHECKPOINT_STREAM_UNKNOWN", message: `stream ${parsed.values.stream} is not defined in the state document`, path: "$.stream" }],
  });
  process.exit(1);
}

try {
  const checkpoint = buildCheckpoint({
    streamId: stream.id,
    role: parsed.values.role ?? null,
    worktree: stream.git.worktree,
    branch: stream.git.branch,
    baseSha: stream.git.baseSha,
    candidateSha: stream.git.candidateSha,
    integrationSha: stream.git.integrationSha,
    state: stream.state,
    revision: String(result.doc.registry.revision),
    leaseId: parsed.values.lease ?? null,
    directiveHash: parsed.values.directive ?? null,
    lastCompletedGate: parsed.values["last-gate"] ?? null,
    nextAtomicAction: stream.nextAction,
    forbiddenBoundaries: parsed.values.boundaries ? parsed.values.boundaries.split("|").map((s) => s.trim()).filter(Boolean) : [],
    pendingApproval: parsed.values["pending-approval"] ?? (stream.approval.presentedReady ? "presented-not-granted" : null),
  });
  emit({
    status: "ok",
    summary: { streamId: stream.id, state: stream.state, revision: result.doc.registry.revision, checkpoint },
    nextActions: [{ streamId: stream.id, nextAction: stream.nextAction }],
    artifacts: [],
    errors: [],
  });
  process.exit(0);
} catch (err) {
  const code = err instanceof CheckpointError ? err.code : "CHECKPOINT_INTERNAL_ERROR";
  emit({
    status: "fail",
    summary: { streamId: stream.id, state: stream.state, revision: result.doc.registry.revision },
    nextActions: [],
    artifacts: [],
    errors: [{ code, message: err.message, path: "$.checkpoint" }],
  });
  process.exit(1);
}
