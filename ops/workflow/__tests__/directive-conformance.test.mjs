// WF-C05 W6 — directive-conformance controls on the workflow's own
// producer->consumer surfaces.
//
// The cycle-state contract is the producer; the renderer, status/liveness,
// verifier, and receipt consumers render or classify its values. These controls
// enforce the three product defect classes the operator named, on the workflow's
// own surfaces, with a real failing-first mutant for each:
//
//   1. server reason absent from client mapping -> producer-domain parity;
//   2. unknown reason dropped instead of conserved -> count conservation;
//   3. stale response accepted after scope transition -> scope-epoch guard.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  SCHEMA_FILE,
  createTempRepo,
  cleanupRepo,
  copyWorkflowToTemp,
  runCli,
  stateDocFromFixture,
} from "./harness.mjs";
import {
  QA_VERDICTS,
  AUDITOR_VERDICTS,
  LEASE_STATES,
  LEASE_ROLES,
  GATE_CLASSES,
} from "../lib/transition.mjs";
import { GATE_CLASSES as READINESS_GATE_CLASSES, READINESS_CLASSES, deriveReadiness } from "../lib/readiness.mjs";
import { SUPPORTED_RECEIPT_VERSIONS, RECEIPT_VERSION, LEGACY_RECEIPT_VERSION } from "../lib/receipt.mjs";
import { summarizeClassifications, CLASSIFICATIONS, classificationTotal } from "../lib/liveness.mjs";
import { observabilityPaths, writeHeartbeat, buildHeartbeat } from "../lib/observability.mjs";

const workflowsDir = path.resolve(path.dirname(SCHEMA_FILE), "..");

function readSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_FILE, "utf8"));
}

function pointer(schema, jsonPointer) {
  let cur = schema;
  for (const raw of jsonPointer.split("/").filter((segment) => segment.length > 0)) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (cur === null || typeof cur !== "object" || !Object.prototype.hasOwnProperty.call(cur, key)) return undefined;
    cur = cur[key];
  }
  return cur;
}

// ---- 1. Producer-domain parity ---------------------------------------------

// Every consumer constant that maps or partitions a schema-declared domain.
const DOMAIN_CHECKS = [
  { domain: "lease.state", pointer: "$defs/lease/properties/state/enum", consumer: () => LEASE_STATES },
  { domain: "lease.role", pointer: "$defs/lease/properties/role/enum", consumer: () => LEASE_ROLES },
  { domain: "review.qaVerdict", pointer: "$defs/review/properties/qaVerdict/enum", consumer: () => QA_VERDICTS, dropNull: true },
  { domain: "review.auditorVerdict", pointer: "$defs/review/properties/auditorVerdict/enum", consumer: () => AUDITOR_VERDICTS, dropNull: true },
  { domain: "gates.plan", pointer: "$defs/gatePlan/required", consumer: () => GATE_CLASSES },
  { domain: "gates.classes", pointer: "$defs/gateClasses/required", consumer: () => READINESS_GATE_CLASSES },
  { domain: "gates.classes", pointer: "$defs/gateClasses/required", consumer: () => GATE_CLASSES },
];

// Returns every schema member the named consumer does not handle. An empty array
// is a full producer->consumer parity proof.
export function domainParityFindings(schema) {
  const findings = [];
  for (const check of DOMAIN_CHECKS) {
    const declared = pointer(schema, check.pointer);
    if (!Array.isArray(declared)) {
      findings.push({ domain: check.domain, reason: `schema pointer ${check.pointer} is not an enum/required array` });
      continue;
    }
    const members = check.dropNull ? declared.filter((member) => member !== null) : declared;
    const handled = new Set(check.consumer());
    for (const member of members) {
      if (!handled.has(member)) findings.push({ domain: check.domain, member });
    }
    for (const member of handled) {
      if (!members.includes(member)) findings.push({ domain: check.domain, member, reason: "consumer handles a member the producer does not emit" });
    }
  }
  return findings;
}

test("every consumer constant covers its complete schema-declared domain", () => {
  const schemaBytes = fs.readFileSync(SCHEMA_FILE);
  const findings = domainParityFindings(readSchema());
  assert.deepEqual(findings, [], `producer-domain parity gaps: ${JSON.stringify(findings)}`);

  // Failing-first mutant: a producer member the consumer does not handle must be
  // named, not silently accepted.
  const patched = readSchema();
  patched.$defs.lease.properties.state.enum.push("REVOKED");
  const mutant = domainParityFindings(patched);
  assert.deepEqual(mutant, [{ domain: "lease.state", member: "REVOKED" }], JSON.stringify(mutant));

  // The schema file itself is untouched by the test-local patch (byte-exact).
  assert.deepEqual(fs.readFileSync(SCHEMA_FILE), schemaBytes, "the schema patch must never be written to disk");
});

test("every readiness class is reachable and derived only from gate classes", () => {
  const zero = () => ({ total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 });
  const gates = (live) => ({
    total: 0,
    passed: 0,
    failed: 0,
    blocked: 0,
    unperformed: 0,
    plan: { MANDATORY_SOURCE: 0, MANDATORY_LIVE: live.total, DEFERRED_EXTERNAL: 0 },
    classes: { MANDATORY_SOURCE: zero(), MANDATORY_LIVE: live, DEFERRED_EXTERNAL: zero() },
  });
  const observed = new Set([
    deriveReadiness(gates(zero())).scope,
    deriveReadiness(gates({ total: 1, passed: 0, failed: 0, blocked: 0, unperformed: 1 })).scope,
    deriveReadiness(gates({ total: 1, passed: 1, failed: 0, blocked: 0, unperformed: 0 })).scope,
  ]);
  assert.deepEqual([...observed].sort(), [...READINESS_CLASSES].sort());
  assert.equal(SUPPORTED_RECEIPT_VERSIONS.has(RECEIPT_VERSION), true);
  assert.equal(SUPPORTED_RECEIPT_VERSIONS.has(LEGACY_RECEIPT_VERSION), true);
});

// ---- 2. Unknown-value conservation -----------------------------------------

export function conservationFindings(summary, total) {
  const findings = [];
  for (const [bucket, count] of Object.entries(summary)) {
    if (!CLASSIFICATIONS.includes(bucket)) findings.push({ bucket, reason: "bucket is not a declared classification" });
    if (!Number.isInteger(count) || count < 0) findings.push({ bucket, reason: `bucket count is not a non-negative integer (${count})` });
  }
  if (classificationTotal(summary) !== total) {
    findings.push({ reason: `sum(buckets) ${classificationTotal(summary)} != total ${total}` });
  }
  return findings;
}

test("an out-of-domain classification is conserved under UNKNOWN, never dropped", () => {
  const views = [{ classification: "ACTIVE" }, { classification: "NOT-A-CLASSIFICATION" }, { classification: undefined }, { classification: "ERROR" }];
  const summary = summarizeClassifications(views);
  assert.equal(summary.ACTIVE, 1);
  assert.equal(summary.ERROR, 1);
  assert.equal(summary.UNKNOWN, 2, "both the unknown string and the missing value land in UNKNOWN");
  assert.deepEqual(conservationFindings(summary, views.length), []);
  assert.equal(classificationTotal(summary), views.length);

  // Failing-first mutant: the previous dropping/NaN-producing iteration violates
  // conservation, so the control would detect a regression in the production
  // module.
  const dropping = {};
  for (const name of CLASSIFICATIONS) dropping[name] = 0;
  for (const view of views) dropping[view.classification] += 1;
  assert.notDeepEqual(conservationFindings(dropping, views.length), [], "the dropping iteration must fail the conservation control");
});

test("the committed conservation control fails against a mutated production module", async (t) => {
  const tree = copyWorkflowToTemp();
  t.after(() => fs.rmSync(tree.dir, { recursive: true, force: true }));
  const target = tree.libLiveness;
  const workspaceBytes = fs.readFileSync(path.join(workflowsDir, "lib", "liveness.mjs"));
  const anchor =
    '    const value = view && typeof view === "object" ? view.classification : null;\n    const bucket = CLASSIFICATIONS.includes(value) ? value : "UNKNOWN";\n    byClassification[bucket] += 1;';
  const source = fs.readFileSync(target, "utf8");
  assert.ok(source.includes(anchor), "the conservation anchor must exist in the production module");
  fs.writeFileSync(target, source.replace(anchor, "    byClassification[view.classification] += 1;"));

  const mutated = await import(`${pathToFileURL(target).href}?mutant=${Date.now()}`);
  const views = [{ classification: "ACTIVE" }, { classification: "NOT-A-CLASSIFICATION" }];
  const summary = mutated.summarizeClassifications(views);
  assert.notDeepEqual(conservationFindings(summary, views.length), [], "the mutated module must fail the conservation control");

  // The workspace module is untouched (the mutant lived only in the disposable tree).
  assert.deepEqual(fs.readFileSync(path.join(workflowsDir, "lib", "liveness.mjs")), workspaceBytes);
});

// ---- 3. Scope-epoch guard --------------------------------------------------

const FOREIGN_SESSION = "ses_foreign_scope";

function writeHeartbeatFor(commonDir, sessionId) {
  const paths = observabilityPaths(commonDir);
  writeHeartbeat(
    paths,
    buildHeartbeat(
      {
        sessionId,
        role: "executor",
        stream: "ORD-1",
        status: "ACTIVE",
        processId: process.pid,
        updatedAt: "2026-09-14T23:59:00.000Z",
      },
      { now: "2026-09-14T23:59:00.000Z" },
    ),
  );
  return paths.sessionFile(sessionId);
}

function scopeFixture(t, { patchStatus }) {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
  });
  const statePath = path.join(repo.dir, "docs", "plans", "scope-state.json");
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(doc, null, 2)}\n`);

  const commonDir = path.join(repo.dir, ".git");
  const foreign = createTempRepo();
  t.after(() => cleanupRepo(foreign.dir));
  const foreignCommon = path.join(foreign.dir, ".git");
  writeHeartbeatFor(foreignCommon, FOREIGN_SESSION);

  let statusCli = path.join(workflowsDir, "status.mjs");
  if (patchStatus) {
    const tree = copyWorkflowToTemp();
    t.after(() => fs.rmSync(tree.dir, { recursive: true, force: true }));
    statusCli = tree.statusCli;
    const anchor = "  const expectedCommonDir = gitCommonDir(result.repoRoot);";
    const source = fs.readFileSync(statusCli, "utf8");
    assert.ok(source.includes(anchor), "the scope-guard anchor must exist in the production module");
    fs.writeFileSync(statusCli, source.replace(anchor, "  const expectedCommonDir = commonDir;"));
  }
  return { repo, statePath, commonDir, foreignCommon, statusCli };
}

test("an explicit --common-dir from a foreign Git scope is rejected (scope-epoch guard)", (t) => {
  const { repo, statePath, commonDir, foreignCommon, statusCli } = scopeFixture(t, { patchStatus: false });

  // Matching scope: unchanged behavior.
  const matching = runCli(statusCli, ["--state", statePath, "--json", "--common-dir", commonDir, "--now", "2026-09-15T00:00:00.000Z"], { cwd: repo.dir });
  assert.equal(matching.status, 0, matching.stdout + matching.stderr);
  assert.equal(matching.json.summary.sessions.total, 0);

  // Foreign scope: fail closed with no foreign sessions or actions rendered.
  const foreign = runCli(statusCli, ["--state", statePath, "--json", "--common-dir", foreignCommon, "--now", "2026-09-15T00:00:00.000Z"], { cwd: repo.dir });
  assert.equal(foreign.status, 1, foreign.stdout + foreign.stderr);
  assert.deepEqual(foreign.json.errors.map((e) => e.code), ["STATUS_SCOPE_MISMATCH"]);
  assert.equal(foreign.json.summary.sessions.total, 0);
  assert.deepEqual(foreign.json.nextActions, []);
});

test("the committed scope guard fails against a mutated production module", (t) => {
  const { repo, statePath, foreignCommon, statusCli } = scopeFixture(t, { patchStatus: true });
  const workspaceBytes = fs.readFileSync(path.join(workflowsDir, "status.mjs"));
  const result = runCli(statusCli, ["--state", statePath, "--json", "--common-dir", foreignCommon, "--now", "2026-09-15T00:00:00.000Z"], { cwd: repo.dir });
  assert.equal(result.status, 0, "the mutant must accept the foreign scope so the control is load-bearing");
  const sessionIds = result.json.summary.sessions.views.map((v) => v.sessionId);
  assert.ok(sessionIds.includes(FOREIGN_SESSION), `foreign session must be accepted by the mutant: ${JSON.stringify(sessionIds)}`);
  // The real workspace status.mjs is byte-identical to its pre-mutant form.
  assert.deepEqual(fs.readFileSync(path.join(workflowsDir, "status.mjs")), workspaceBytes);
});
