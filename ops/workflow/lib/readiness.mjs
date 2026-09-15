// ops/workflow/lib/readiness.mjs
// The single readiness-derivation implementation shared by the verifier, the
// renderer, and the closure-receipt consumer.
//
// A cycle that has only exercised source gates has NOT demonstrated deployment
// or live readiness, so an ACCEPT_READY/AUDIT_CLEAR verdict alone can never
// render as live. Readiness is a pure function of the predeclared gate classes:
//
//   SOURCE_ONLY   - no mandatory live gate was predeclared; this acceptance is a
//                   source-only acceptance and never a deployment claim.
//   LIVE_PENDING  - mandatory live gates exist and at least one is
//                   failed/blocked/unperformed.
//   LIVE_ACCEPTED - mandatory live gates exist and every one passed.
//
// The derivation must never read a review verdict: verdicts attest the review
// layer, not the live layer.
export const GATE_CLASSES = ["MANDATORY_SOURCE", "MANDATORY_LIVE", "DEFERRED_EXTERNAL"];
export const READINESS_CLASSES = ["SOURCE_ONLY", "LIVE_PENDING", "LIVE_ACCEPTED"];

function zeroCounters() {
  return { total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 };
}

export function mandatoryLiveCounters(gates) {
  const classes = gates && typeof gates === "object" ? gates.classes : null;
  const live = classes && typeof classes === "object" ? classes.MANDATORY_LIVE : null;
  if (!live || typeof live !== "object") return zeroCounters();
  const counters = zeroCounters();
  for (const key of Object.keys(counters)) {
    const value = live[key];
    counters[key] = typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
  }
  return counters;
}

export function deriveReadiness(gates) {
  const mandatoryLive = mandatoryLiveCounters(gates);
  if (mandatoryLive.total === 0) {
    return { scope: "SOURCE_ONLY", mandatoryLive, pendingCount: 0 };
  }
  const pendingCount = mandatoryLive.failed + mandatoryLive.blocked + mandatoryLive.unperformed;
  if (pendingCount > 0) {
    return { scope: "LIVE_PENDING", mandatoryLive, pendingCount };
  }
  return { scope: "LIVE_ACCEPTED", mandatoryLive, pendingCount: 0 };
}

export const READINESS_RULE_LINE =
  "Readiness is derived only from the predeclared gate classes: SOURCE_ONLY when no MANDATORY_LIVE gate was predeclared, LIVE_PENDING while any MANDATORY_LIVE gate is failed/blocked/unperformed, and LIVE_ACCEPTED only when every MANDATORY_LIVE gate passed. A source-only ACCEPT_READY or AUDIT_CLEAR is never deployment or live readiness.";
