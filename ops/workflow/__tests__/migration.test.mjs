// WF-C05 W7 — deterministic 1.1.0 -> 1.2.0 migration and committed-document
// reproduction.
//
// The migration is a pure, deterministic function of the document plus the
// workspace artifact bytes. It preserves every historical identity verbatim and
// never rewrites receipts. The reproduction check derives the literal
// pre-migration committed document mechanically from this checkout's own Git
// history — the most recent commit whose version of the state path is still
// 1.1.0 — and must land on the committed 1.2.0 bytes exactly.
//
// No pre-migration commit SHA is hard-coded. A pinned base is only truthful
// while the registry stands still; on an integrated tree the registry has
// advanced in parallel, so the reproduction must be derived from whatever
// history this tree actually carries.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { REPO_ROOT, getSharedRepo, stateDocFromFixture, verifyInProcess, writeStateDoc, sha256 } from "./harness.mjs";
import { migrateStateDocument, CONTRACT_VERSION, PREVIOUS_CONTRACT_VERSION } from "../lib/migrate.mjs";
import { deriveReadiness } from "../lib/readiness.mjs";
import { sha256Hex } from "../lib/util.mjs";

const STATE_REL = "docs/plans/atlas-delivery-cycles.json";
const COMMITTED_STATE = path.join(REPO_ROOT, ...STATE_REL.split("/"));

function gitShow(sha, relPath) {
  const res = spawnSync("git", ["-C", REPO_ROOT, "show", `${sha}:${relPath}`], { encoding: "utf8", windowsHide: true });
  assert.equal(res.status, 0, `git show failed: ${res.stderr}`);
  return res.stdout;
}

function tryGitShow(sha, relPath) {
  const res = spawnSync("git", ["-C", REPO_ROOT, "show", `${sha}:${relPath}`], { encoding: "utf8", windowsHide: true });
  return res.status === 0 ? res.stdout : null;
}

// Every commit that changed the state path, newest first, from HEAD.
function gitLogShas(relPath) {
  const res = spawnSync("git", ["-C", REPO_ROOT, "log", "--format=%H", "--", relPath], { encoding: "utf8", windowsHide: true });
  assert.equal(res.status, 0, `git log -- ${relPath} failed: ${res.stderr}`);
  return res.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function headSha() {
  const res = spawnSync("git", ["-C", REPO_ROOT, "rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true });
  assert.equal(res.status, 0, `git rev-parse HEAD failed: ${res.stderr}`);
  return res.stdout.trim();
}

function isAncestor(ancestor, descendant) {
  const res = spawnSync("git", ["-C", REPO_ROOT, "merge-base", "--is-ancestor", ancestor, descendant], { encoding: "utf8", windowsHide: true });
  assert.ok(res.status === 0 || res.status === 1, `git merge-base --is-ancestor failed: ${res.stderr}`);
  return res.status === 0;
}

// The single 1.1.0 gate the derivation walks on. It is also exercised directly
// by the adversarial control below so that the guard itself is load-bearing
// rather than implicit in the loop.
function isPreMigrationDocument(doc) {
  return !!doc && typeof doc === "object" && doc.contractVersion === PREVIOUS_CONTRACT_VERSION;
}

// Mechanically derive the pre-migration committed document: walk the history of
// the state path from HEAD backwards and take the most recent commit whose
// committed document is still the previous contract. No SHA is hard-coded and
// no commit is required to contain its own final SHA. Returns the commit, its
// parsed document, and the newer commits that were examined and skipped.
function derivePreMigrationCommit(relPath) {
  const skipped = [];
  for (const sha of gitLogShas(relPath)) {
    const raw = tryGitShow(sha, relPath);
    if (raw === null) continue;
    let doc = null;
    try {
      doc = JSON.parse(raw);
    } catch {
      continue;
    }
    if (isPreMigrationDocument(doc)) return { sha, doc, skipped };
    skipped.push({ sha, contractVersion: doc && doc.contractVersion });
  }
  return null;
}

// The migration is document-structural; the artifact pins are refreshed from the
// workspace because this cycle changed one pinned file. Every other identity is
// untouched.
function refreshArtifactPins(doc) {
  for (const stream of doc.streams) {
    for (const artifact of stream.artifacts) {
      artifact.sha256 = sha256Hex(fs.readFileSync(path.join(REPO_ROOT, ...artifact.path.split("/"))));
    }
  }
  return doc;
}

test("a 1.1.0 document migrates to 1.2.0 and verifies clean by construction", (t) => {
  const repo = getSharedRepo();
  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.contractVersion = PREVIOUS_CONTRACT_VERSION;
    const stream = d.streams[0];
    stream.gates = { total: 4, passed: 4, failed: 0, blocked: 0, unperformed: 0 };
    stream.review = { qaVerdict: "ACCEPT_READY", qaSessionId: "ses-qa-1", auditorVerdict: null, auditorSessionId: null, auditRequired: false };
    stream.corrections = [
      { round: 1, baseSha: repo.baseSha, candidateSha: repo.candidateSha, reason: "bounded correction", qaVerdict: "ACCEPT_READY", qaSessionId: "ses-qa-1", auditorVerdict: null, auditorSessionId: null },
    ];
    stream.git = { worktree: null, branch: "work/x", baseSha: repo.baseSha, candidateSha: repo.candidateSha, integrationSha: null, changedPaths: ["candidate.txt"], remoteObservation: null };
  });

  const { doc: migrated, changed, changes } = migrateStateDocument(doc);
  assert.equal(changed, true);
  assert.ok(changes.length > 0);
  assert.equal(migrated.contractVersion, CONTRACT_VERSION);
  const stream = migrated.streams[0];

  // Gates: the historical total becomes the MANDATORY_SOURCE class and plan.
  assert.deepEqual(stream.gates.plan, { MANDATORY_SOURCE: 4, MANDATORY_LIVE: 0, DEFERRED_EXTERNAL: 0 });
  assert.deepEqual(stream.gates.classes.MANDATORY_SOURCE, { total: 4, passed: 4, failed: 0, blocked: 0, unperformed: 0 });
  assert.deepEqual(stream.gates.classes.MANDATORY_LIVE, { total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 });
  assert.equal(deriveReadiness(stream.gates).scope, "SOURCE_ONLY");

  // QA rounds: synthesized from the correction plus the final review verdict,
  // renumbered 1..n with no fabricated correction round.
  assert.deepEqual(stream.review.qaRounds, [{ round: 1, verdict: "ACCEPT_READY", sessionId: "ses-qa-1" }]);
  assert.equal(stream.review.qaVerdict, "ACCEPT_READY");

  // Historical identities are preserved verbatim.
  assert.equal(stream.git.baseSha, repo.baseSha);
  assert.equal(stream.git.candidateSha, repo.candidateSha);
  assert.equal(stream.corrections[0].candidateSha, repo.candidateSha);
  assert.equal(stream.corrections[0].qaSessionId, "ses-qa-1");

  const statePath = writeStateDoc(repo, "migration-1.1.0.json", migrated);
  const result = verifyInProcess(statePath);
  assert.equal(result.ok, true, JSON.stringify(result.errors));

  // Migrating an already-1.2.0 document is a no-op.
  const again = migrateStateDocument(migrated);
  assert.equal(again.changed, false);
  assert.deepEqual(again.doc, migrated);
});

test("migrating the derived pre-migration committed document reproduces the committed bytes", () => {
  const head = headSha();
  const derived = derivePreMigrationCommit(STATE_REL);
  assert.ok(derived, `no commit in history carries a ${PREVIOUS_CONTRACT_VERSION} ${STATE_REL}`);

  // The derived commit must be a real, strictly-newer-than-it ancestor of HEAD
  // whose document is genuinely the pre-migration contract.
  assert.notEqual(derived.sha, head, "the derived pre-migration commit must not be HEAD");
  assert.ok(isAncestor(derived.sha, head), "the derived pre-migration commit must be an ancestor of HEAD");
  assert.equal(derived.doc.contractVersion, PREVIOUS_CONTRACT_VERSION, "the derived document must be the pre-migration contract");

  // The derivation must not be vacuous: at least one newer history entry was
  // walked past, and the newest one is already the migrated contract.
  assert.ok(derived.skipped.length > 0, "the derivation must walk past newer commits, not return the newest entry");
  assert.equal(derived.skipped[0].contractVersion, CONTRACT_VERSION, "the newest state-path change must already be the migrated contract");

  const revisionBefore = derived.doc.registry.revision;
  const { doc } = migrateStateDocument(derived.doc);
  refreshArtifactPins(doc);
  const rendered = `${JSON.stringify(doc, null, 2)}\n`;
  const committed = fs.readFileSync(COMMITTED_STATE, "utf8");

  assert.equal(sha256(Buffer.from(rendered)), sha256(Buffer.from(committed)), "the migrated document must reproduce the committed bytes");
  assert.equal(rendered, committed);
  assert.equal(doc.registry.revision, revisionBefore, "a version migration is not a transition and never advances the revision");
  assert.equal(sha256(fs.readFileSync(COMMITTED_STATE)), sha256(Buffer.from(committed)));
});

test("the derivation's 1.1.0 guard rejects the committed HEAD document", () => {
  // HEAD is already migrated to 1.2.0, so it must be rejected by the same
  // predicate the derivation walks on. This is the control that proves the
  // derivation actually tests the contract version instead of trusting a
  // hard-coded base or the newest entry.
  const headDoc = JSON.parse(gitShow("HEAD", STATE_REL));
  assert.equal(headDoc.contractVersion, CONTRACT_VERSION, "the committed HEAD document must already be migrated");
  assert.equal(isPreMigrationDocument(headDoc), false, "a 1.2.0 document must be rejected by the 1.1.0 guard");

  // Migrating the already-migrated HEAD document is a no-op, so deriving from it
  // would make the byte-identity assertion vacuous. The guard is exactly what
  // forces the real 1.1.0 -> 1.2.0 path to run.
  const noop = migrateStateDocument(headDoc);
  assert.equal(noop.changed, false, "the committed 1.2.0 document must already be migrated, so it must never be the derivation's answer");

  const derived = derivePreMigrationCommit(STATE_REL);
  assert.notEqual(derived.sha, headSha(), "the guarded derivation must not select HEAD");
  assert.equal(isPreMigrationDocument(derived.doc), true, "the derived document must pass the 1.1.0 guard");
});

test("a mutated migrated document fails the byte-identity reproduction", () => {
  const derived = derivePreMigrationCommit(STATE_REL);
  assert.ok(derived, `no commit in history carries a ${PREVIOUS_CONTRACT_VERSION} ${STATE_REL}`);
  const { doc } = migrateStateDocument(derived.doc);
  refreshArtifactPins(doc);

  // Baseline: the unmutated migration reproduces the committed bytes.
  const committed = fs.readFileSync(COMMITTED_STATE, "utf8");
  const baseline = `${JSON.stringify(doc, null, 2)}\n`;
  assert.equal(sha256(Buffer.from(baseline)), sha256(Buffer.from(committed)), "the baseline migration must reproduce the committed bytes");

  // Adversarial: one altered gate counter must break byte-identity. If this
  // still matched, the reproduction assertion would be vacuous.
  const mutated = JSON.parse(JSON.stringify(doc));
  mutated.streams[0].gates.classes.MANDATORY_SOURCE.passed += 1;
  const mutatedRendered = `${JSON.stringify(mutated, null, 2)}\n`;
  assert.notEqual(mutatedRendered, baseline, "the mutant must actually change the bytes");
  assert.notEqual(sha256(Buffer.from(mutatedRendered)), sha256(Buffer.from(committed)), "a mutated migrated document must not reproduce the committed bytes");
});
