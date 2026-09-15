// WF-C05 W7 — deterministic 1.1.0 -> 1.2.0 migration and committed-document
// reproduction.
//
// The migration is a pure, deterministic function of the document plus the
// workspace artifact bytes. It preserves every historical identity verbatim and
// never rewrites receipts. The reproduction check starts from the literal
// pre-migration committed bytes (`git show <accepted-base>:...`) and must land
// on the committed 1.2.0 bytes exactly.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { REPO_ROOT, getSharedRepo, stateDocFromFixture, verifyInProcess, writeStateDoc, sha256 } from "./harness.mjs";
import { migrateStateDocument, CONTRACT_VERSION, PREVIOUS_CONTRACT_VERSION } from "../lib/migrate.mjs";
import { deriveReadiness } from "../lib/readiness.mjs";
import { sha256Hex } from "../lib/util.mjs";

// The accepted base of the WF-C05 cycle: the pre-migration committed document.
const ACCEPTED_BASE = "387a1f6d0d1e4c44eb41125f717e2aa50797238f";
const STATE_REL = "docs/plans/atlas-delivery-cycles.json";
const COMMITTED_STATE = path.join(REPO_ROOT, ...STATE_REL.split("/"));

function gitShow(sha, relPath) {
  const res = spawnSync("git", ["-C", REPO_ROOT, "show", `${sha}:${relPath}`], { encoding: "utf8", windowsHide: true });
  assert.equal(res.status, 0, `git show failed: ${res.stderr}`);
  return res.stdout;
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

test("migrating the pre-migration committed document reproduces the committed bytes", () => {
  const baseDoc = JSON.parse(gitShow(ACCEPTED_BASE, STATE_REL));
  assert.equal(baseDoc.contractVersion, PREVIOUS_CONTRACT_VERSION, "the accepted base must be the 1.1.0 document");
  assert.equal(baseDoc.registry.revision, 37, "the migration must not change the registry revision");

  const { doc } = migrateStateDocument(baseDoc);
  refreshArtifactPins(doc);
  const rendered = `${JSON.stringify(doc, null, 2)}\n`;
  const committed = fs.readFileSync(COMMITTED_STATE, "utf8");

  assert.equal(sha256(Buffer.from(rendered)), sha256(Buffer.from(committed)), "the migrated document must reproduce the committed bytes");
  assert.equal(rendered, committed);
  assert.equal(doc.registry.revision, 37, "a version migration is not a transition and never advances the revision");
  assert.equal(sha256(fs.readFileSync(COMMITTED_STATE)), sha256(Buffer.from(committed)));
});
