// ops/workflow/lib/migrate.mjs
// Pure migration of earlier delivery-cycle state documents onto the current
// contract. It is deterministic, never mutates its input, and preserves every
// historical identity verbatim.
//
// 1.0.0 -> 1.1.0:
//   - the ambiguous `git.remoteSha` scalar becomes a nullable, explicitly
//     non-self-referential `git.remoteObservation` snapshot { ref, sha,
//     observedAt, kind }; a recorded SHA is never required to equal the commit
//     that contains the field or the current tip;
//   - `registry.revision` is introduced as the document CAS token;
//   - the top-level `leases` array is introduced.
//
// 1.1.0 -> 1.2.0:
//   - `gates` gains a predeclared per-class plan and the five class tallies. The
//     migration is conservative: every historical gate is synthesized as
//     MANDATORY_SOURCE, so the plan/class equality rules hold immediately and no
//     live gate is ever fabricated or silently deferred;
//   - `review.qaRounds` is synthesized deterministically from `corrections[]`
//     (each recorded correction's non-null QA verdict in round order) plus the
//     final `review.qaVerdict`/`qaSessionId`, renumbered `1..n`. Historical
//     identities are copied verbatim; receipts are never rewritten.
import { isPlainObject } from "./schema.mjs";

export const LEGACY_CONTRACT_VERSION = "1.0.0";
export const PREVIOUS_CONTRACT_VERSION = "1.1.0";
export const CONTRACT_VERSION = "1.2.0";

function countersFrom(gates) {
  return {
    total: gates.total,
    passed: gates.passed,
    failed: gates.failed,
    blocked: gates.blocked,
    unperformed: gates.unperformed,
  };
}

function zeroCounters() {
  return { total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 };
}

// Deterministic 1.1.0 -> 1.2.0 gate-class synthesis.
function upgradeGates(stream, changes) {
  const gates = stream.gates;
  if (!isPlainObject(gates)) return;
  const needsPlan = !isPlainObject(gates.plan);
  const needsClasses = !isPlainObject(gates.classes);
  if (needsClasses) {
    gates.classes = {
      MANDATORY_SOURCE: countersFrom(gates),
      MANDATORY_LIVE: zeroCounters(),
      DEFERRED_EXTERNAL: zeroCounters(),
    };
    changes.push(`${stream.id}: gates.classes synthesized (existing ${gates.total} gates -> MANDATORY_SOURCE)`);
  }
  if (needsPlan && isPlainObject(gates.classes)) {
    gates.plan = {
      MANDATORY_SOURCE: gates.classes.MANDATORY_SOURCE.total,
      MANDATORY_LIVE: gates.classes.MANDATORY_LIVE.total,
      DEFERRED_EXTERNAL: gates.classes.DEFERRED_EXTERNAL.total,
    };
    changes.push(`${stream.id}: gates.plan synthesized from the existing class totals`);
  }
}

// Deterministic 1.1.0 -> 1.2.0 QA-round synthesis. Corrections are copied in
// round order; a correction whose qaVerdict is null contributes no round. The
// final review verdict is appended when it is not already the last round.
function synthesizeQaRounds(stream, changes) {
  const review = stream.review;
  if (!isPlainObject(review)) return;
  if (Array.isArray(review.qaRounds)) return;
  const rounds = [];
  const corrections = Array.isArray(stream.corrections) ? [...stream.corrections].sort((a, b) => a.round - b.round) : [];
  for (const correction of corrections) {
    if (correction && correction.qaVerdict !== null && correction.qaVerdict !== undefined) {
      rounds.push({ verdict: correction.qaVerdict, sessionId: correction.qaSessionId === undefined ? null : correction.qaSessionId });
    }
  }
  const finalVerdict = review.qaVerdict;
  if (finalVerdict !== null && finalVerdict !== undefined) {
    const last = rounds[rounds.length - 1];
    const finalSession = review.qaSessionId === undefined ? null : review.qaSessionId;
    if (!last || last.verdict !== finalVerdict || (last.sessionId ?? null) !== (finalSession ?? null)) {
      rounds.push({ verdict: finalVerdict, sessionId: finalSession });
    }
  }
  review.qaRounds = rounds.map((round, i) => ({ round: i + 1, verdict: round.verdict, sessionId: round.sessionId ?? null }));
  changes.push(`${stream.id}: review.qaRounds synthesized (${review.qaRounds.length} round(s))`);
}

export function migrateStateDocument(input, options = {}) {
  if (!isPlainObject(input)) throw new TypeError("migrateStateDocument expects a plain object");
  const doc = JSON.parse(JSON.stringify(input));
  const changes = [];

  if (doc.contractVersion === LEGACY_CONTRACT_VERSION) {
    doc.contractVersion = PREVIOUS_CONTRACT_VERSION;
    changes.push("contractVersion 1.0.0 -> 1.1.0");
  }

  if (!isPlainObject(doc.registry)) doc.registry = {};
  if (doc.registry.revision === undefined) {
    doc.registry.revision = 1;
    changes.push("registry.revision initialized to 1");
  }

  if (!Array.isArray(doc.leases)) {
    doc.leases = [];
    changes.push("leases initialized to []");
  }

  for (const stream of doc.streams || []) {
    const git = stream.git;
    if (!isPlainObject(git)) continue;
    if (!Object.prototype.hasOwnProperty.call(git, "remoteSha")) {
      if (!Object.prototype.hasOwnProperty.call(git, "remoteObservation")) {
        git.remoteObservation = null;
        changes.push(`${stream.id}: remoteObservation initialized to null`);
      }
      continue;
    }
    const legacy = git.remoteSha;
    if (legacy === null || legacy === undefined) {
      git.remoteObservation = null;
    } else {
      git.remoteObservation = {
        ref: (options.refFor && options.refFor(stream)) || "refs/remotes/origin/main",
        sha: legacy,
        observedAt: (options.observedAtFor && options.observedAtFor(stream)) || stream.stateUpdatedAt,
        kind: (options.kindFor && options.kindFor(stream)) || "REMOTE_TRACKING_REF",
      };
    }
    delete git.remoteSha;
    changes.push(`${stream.id}: remoteSha -> remoteObservation`);
  }

  if (doc.contractVersion === PREVIOUS_CONTRACT_VERSION || doc.contractVersion === CONTRACT_VERSION) {
    if (doc.contractVersion === PREVIOUS_CONTRACT_VERSION) {
      doc.contractVersion = CONTRACT_VERSION;
      changes.push("contractVersion 1.1.0 -> 1.2.0");
    }
    for (const stream of doc.streams || []) {
      upgradeGates(stream, changes);
      synthesizeQaRounds(stream, changes);
    }
  }

  return { doc, changed: changes.length > 0, changes };
}
