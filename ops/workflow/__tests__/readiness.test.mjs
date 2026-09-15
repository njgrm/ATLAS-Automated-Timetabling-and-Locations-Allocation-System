// WF-C05 W4 — source-only acceptance never renders as live readiness.
//
// `deriveReadiness` is the single production derivation shared by the verifier,
// the renderer, and the closure-receipt consumer. This suite pins its three
// scopes and proves with a real failing-first mutant that readiness is never
// inferred from a review verdict (ACCEPT_READY / AUDIT_CLEAR) while no
// MANDATORY_LIVE gate was predeclared.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SCHEMA_FILE, copyWorkflowToTemp } from "./harness.mjs";
import { GATE_CLASSES, READINESS_CLASSES, deriveReadiness } from "../lib/readiness.mjs";

const workflowsDir = path.resolve(path.dirname(SCHEMA_FILE), "..");
const zero = () => ({ total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 });

function gatesWith(live) {
  return {
    total: 0,
    passed: 0,
    failed: 0,
    blocked: 0,
    unperformed: 0,
    plan: { MANDATORY_SOURCE: 0, MANDATORY_LIVE: live.total, DEFERRED_EXTERNAL: 0 },
    classes: { MANDATORY_SOURCE: zero(), MANDATORY_LIVE: { ...live }, DEFERRED_EXTERNAL: zero() },
  };
}

const SOURCE_ONLY_GATES = gatesWith({ total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 });
const LIVE_PENDING_GATES = gatesWith({ total: 2, passed: 1, failed: 0, blocked: 0, unperformed: 1 });
const LIVE_ACCEPTED_GATES = gatesWith({ total: 2, passed: 2, failed: 0, blocked: 0, unperformed: 0 });

test("readiness is derived only from the predeclared gate classes", () => {
  assert.deepEqual(GATE_CLASSES, ["MANDATORY_SOURCE", "MANDATORY_LIVE", "DEFERRED_EXTERNAL"]);
  assert.deepEqual(READINESS_CLASSES, ["SOURCE_ONLY", "LIVE_PENDING", "LIVE_ACCEPTED"]);
  assert.equal(deriveReadiness(SOURCE_ONLY_GATES).scope, "SOURCE_ONLY");
  assert.equal(deriveReadiness(LIVE_PENDING_GATES).scope, "LIVE_PENDING");
  assert.equal(deriveReadiness(LIVE_PENDING_GATES).pendingCount, 1);
  assert.equal(deriveReadiness(LIVE_ACCEPTED_GATES).scope, "LIVE_ACCEPTED");
  // A failed/blocked/unperformed mandatory live gate is never accepted.
  assert.equal(deriveReadiness(gatesWith({ total: 1, passed: 0, failed: 1, blocked: 0, unperformed: 0 })).scope, "LIVE_PENDING");
  assert.equal(deriveReadiness(gatesWith({ total: 1, passed: 0, failed: 0, blocked: 1, unperformed: 0 })).scope, "LIVE_PENDING");
});

test("a source-only derivation is never LIVE_ACCEPTED, even after an ACCEPT_READY/AUDIT_CLEAR verdict", () => {
  // The verdict lives on the stream, not in the gate classes: the derivation
  // takes only `gates`, so a verdict can never lift a source-only cycle.
  const stream = {
    state: "COMPLETE",
    review: { qaVerdict: "ACCEPT_READY", auditorVerdict: "AUDIT_CLEAR" },
    gates: SOURCE_ONLY_GATES,
  };
  const derivation = deriveReadiness(stream.gates);
  assert.equal(derivation.scope, "SOURCE_ONLY");
  assert.notEqual(derivation.scope, "LIVE_ACCEPTED");
});

test("a mutant that infers LIVE_ACCEPTED from a source-only gate set fails this control", async (t) => {
  const tree = copyWorkflowToTemp();
  t.after(() => fs.rmSync(tree.dir, { recursive: true, force: true }));
  const workspaceBytes = fs.readFileSync(path.join(workflowsDir, "lib", "readiness.mjs"));
  const anchor = '  if (mandatoryLive.total === 0) {\n    return { scope: "SOURCE_ONLY", mandatoryLive, pendingCount: 0 };\n  }';
  const source = fs.readFileSync(tree.libReadiness, "utf8");
  assert.ok(source.includes(anchor), "the source-only anchor must exist in the production module");
  fs.writeFileSync(tree.libReadiness, source.replace(anchor, '  if (mandatoryLive.total === 0) {\n    return { scope: "LIVE_ACCEPTED", mandatoryLive, pendingCount: 0 };\n  }'));

  const mutated = await import(`${pathToFileURL(tree.libReadiness).href}?mutant=${Date.now()}`);
  assert.equal(mutated.deriveReadiness(SOURCE_ONLY_GATES).scope, "LIVE_ACCEPTED", "the mutant must invert the control");

  // The real production derivation still returns SOURCE_ONLY.
  assert.equal(deriveReadiness(SOURCE_ONLY_GATES).scope, "SOURCE_ONLY");
  // And the workspace module is byte-identical to its pre-mutant form.
  assert.deepEqual(fs.readFileSync(path.join(workflowsDir, "lib", "readiness.mjs")), workspaceBytes);
});
