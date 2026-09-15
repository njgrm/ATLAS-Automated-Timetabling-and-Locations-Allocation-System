// WF-C05 W7 — deterministic 1.1.0 -> 1.2.0 migration and committed-document
// reproduction.
//
// The migration is a pure, deterministic function of a document plus the
// artifact bytes that document pins. The reproduction is therefore a statement
// about an IMMUTABLE COMMIT PAIR in Git history, never about the current
// checkout:
//
//   derived pre-migration commit  (state path is contractVersion 1.1.0)
//   -> immediate state-path successor (state path is contractVersion 1.2.0)
//
// Both sides are read from Git objects: the expected document is
// `migrateStateDocument(pre-migration document)` with every artifact pin set to
// the pinned file's bytes AT THE MIGRATION COMMIT's tree, and it must equal that
// commit's own committed state document byte for byte. Reading the mutable
// working-tree state file or workspace artifact bytes would fail as soon as any
// later state-path commit (for example a recorded transition that advances
// `registry.revision`) landed above the migration commit that is exactly what
// the checkout-stability control below reproduces.
//
// No commit SHA is hard-coded. The pre-migration commit is derived mechanically
// from this checkout's own history, and its successor is derived mechanically
// from the same state-path log.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { REPO_ROOT, getSharedRepo, stateDocFromFixture, verifyInProcess, writeStateDoc } from "./harness.mjs";
import { migrateStateDocument, CONTRACT_VERSION, PREVIOUS_CONTRACT_VERSION } from "../lib/migrate.mjs";
import { deriveReadiness } from "../lib/readiness.mjs";
import { sha256Hex } from "../lib/util.mjs";

const STATE_REL = "docs/plans/atlas-delivery-cycles.json";

function runGit(dir, args, options = {}) {
  return spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", windowsHide: true, ...options });
}

function gitShowText(dir, sha, relPath) {
  const res = runGit(dir, ["show", `${sha}:${relPath}`]);
  assert.equal(res.status, 0, `git show ${sha.slice(0, 12)}:${relPath} failed: ${res.stderr}`);
  return res.stdout;
}

function tryGitShowText(dir, sha, relPath) {
  const res = runGit(dir, ["show", `${sha}:${relPath}`]);
  return res.status === 0 ? res.stdout : null;
}

function gitShowBytes(dir, sha, relPath) {
  const res = spawnSync("git", ["-C", dir, "show", `${sha}:${relPath}`], { encoding: "buffer", windowsHide: true });
  assert.equal(res.status, 0, `git show ${sha.slice(0, 12)}:${relPath} failed: ${res.stderr}`);
  return res.stdout;
}

// Every commit that changed the state path, newest first, from HEAD.
function gitLogShas(dir, relPath) {
  const res = runGit(dir, ["log", "--format=%H", "--", relPath]);
  assert.equal(res.status, 0, `git log -- ${relPath} failed: ${res.stderr}`);
  return res.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function headSha(dir) {
  const res = runGit(dir, ["rev-parse", "HEAD"]);
  assert.equal(res.status, 0, `git rev-parse HEAD failed: ${res.stderr}`);
  return res.stdout.trim();
}

function isAncestor(dir, ancestor, descendant) {
  const res = runGit(dir, ["merge-base", "--is-ancestor", ancestor, descendant]);
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
// parsed document, its position in the state-path log, and the newer commits
// that were examined and skipped.
function derivePreMigrationCommit(dir, relPath) {
  const shas = gitLogShas(dir, relPath);
  const skipped = [];
  for (let index = 0; index < shas.length; index += 1) {
    const raw = tryGitShowText(dir, shas[index], relPath);
    if (raw === null) continue;
    let doc = null;
    try {
      doc = JSON.parse(raw);
    } catch {
      continue;
    }
    if (isPreMigrationDocument(doc)) return { sha: shas[index], doc, index, shas, skipped };
    skipped.push({ sha: shas[index], contractVersion: doc && doc.contractVersion });
  }
  return null;
}

// The immediate state-path successor: the next-newer entry in the same log. It
// must exist, be a real descendant of the derived commit, and already carry the
// migrated contract — otherwise "migrating the pre-migration document" would not
// be a statement about the migration commit at all.
function deriveMigrationSuccessor(dir, relPath, derived) {
  const successorSha = derived.index > 0 ? derived.shas[derived.index - 1] : null;
  assert.ok(successorSha, "the derived pre-migration commit must have a newer state-path successor");
  assert.notEqual(successorSha, derived.sha, "the successor must be a different commit");
  assert.ok(
    isAncestor(dir, derived.sha, successorSha),
    "the state-path successor must descend from the derived pre-migration commit",
  );
  const raw = gitShowText(dir, successorSha, relPath);
  const doc = JSON.parse(raw);
  assert.equal(doc.contractVersion, CONTRACT_VERSION, "the immediate state-path successor must already carry the migrated contract");
  return { sha: successorSha, doc, raw };
}

// migrate(pre-migration document) with every artifact pin taken from the
// migration commit's OWN tree — never the workspace. Fail closed if a pinned
// path is absent there: an unresolved pin must not be silently skipped.
function migrateAtMigrationCommit(dir, migrationSha, preMigrationDoc) {
  const { doc } = migrateStateDocument(preMigrationDoc);
  let pins = 0;
  for (const stream of doc.streams || []) {
    for (const artifact of stream.artifacts || []) {
      artifact.sha256 = sha256Hex(gitShowBytes(dir, migrationSha, artifact.path));
      pins += 1;
    }
  }
  return { doc, pins };
}

// The production reproduction: both sides read from Git objects, never the
// checkout. Shared by the repository check and the checkout-stability control so
// that a regression back to workspace reads fails the control.
function reproduceCommittedMigration(dir, relPath) {
  const derived = derivePreMigrationCommit(dir, relPath);
  if (!derived) throw new Error(`no commit in history carries a ${PREVIOUS_CONTRACT_VERSION} ${relPath}`);
  const migration = deriveMigrationSuccessor(dir, relPath, derived);
  const { doc, pins } = migrateAtMigrationCommit(dir, migration.sha, derived.doc);
  const expected = `${JSON.stringify(doc, null, 2)}\n`;
  return { derived, migration, doc, pins, expected, committed: migration.raw };
}

const FIXTURE_GIT_IDENT = [
  "-c",
  "user.name=WF-C05 R2 Fixture",
  "-c",
  "user.email=wfc05-r2@example.invalid",
  "-c",
  "commit.gpgsign=false",
];

function commitAll(dir, message) {
  const add = runGit(dir, ["add", "-A"]);
  assert.equal(add.status, 0, `git add failed: ${add.stderr}`);
  const commit = runGit(dir, [...FIXTURE_GIT_IDENT, "commit", "-m", message]);
  assert.equal(commit.status, 0, `git commit failed: ${commit.stderr}`);
}

function writeText(dir, relPath, contents) {
  const filePath = path.join(dir, ...relPath.split("/"));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
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

test("migrating the derived pre-migration document reproduces the migration commit's committed bytes", () => {
  // Both sides of this comparison are Git objects. The working-tree state file
  // and workspace artifact bytes are never read here.
  const { derived, migration, doc, pins, expected, committed } = reproduceCommittedMigration(REPO_ROOT, STATE_REL);

  // The derived commit must be a real, strictly-newer-than-it ancestor of HEAD
  // whose document is genuinely the pre-migration contract.
  const head = headSha(REPO_ROOT);
  assert.notEqual(derived.sha, head, "the derived pre-migration commit must not be HEAD");
  assert.ok(isAncestor(REPO_ROOT, derived.sha, head), "the derived pre-migration commit must be an ancestor of HEAD");
  assert.equal(derived.doc.contractVersion, PREVIOUS_CONTRACT_VERSION, "the derived document must be the pre-migration contract");

  // The derivation must not be vacuous: at least one newer history entry was
  // walked past, and the newest one is already the migrated contract.
  assert.ok(derived.skipped.length > 0, "the derivation must walk past newer commits, not return the newest entry");
  assert.equal(derived.skipped[0].contractVersion, CONTRACT_VERSION, "the newest state-path change must already be the migrated contract");

  // The successor is the migration commit, and every artifact pin in the
  // expected document came from that commit's tree.
  assert.notEqual(migration.sha, head, "the migration commit must not be HEAD on an integrated tree");
  assert.equal(migration.doc.contractVersion, CONTRACT_VERSION, "the successor's own committed document must be the migrated contract");
  assert.ok(pins > 0, "the migration commit must actually pin at least one artifact");

  const revisionBefore = derived.doc.registry.revision;
  assert.equal(sha256Hex(Buffer.from(expected)), sha256Hex(Buffer.from(committed)), "the migrated document must reproduce the migration commit's bytes");
  assert.equal(expected, committed);
  assert.equal(doc.registry.revision, revisionBefore, "a version migration is not a transition and never advances the revision");
  assert.equal(JSON.parse(committed).registry.revision, revisionBefore, "the migration commit's own document must carry the same revision");
});

test("the derivation's 1.1.0 guard rejects the committed HEAD document", () => {
  // HEAD is already migrated to 1.2.0, so it must be rejected by the same
  // predicate the derivation walks on. This is the control that proves the
  // derivation actually tests the contract version instead of trusting a
  // hard-coded base or the newest entry.
  const headDoc = JSON.parse(gitShowText(REPO_ROOT, "HEAD", STATE_REL));
  assert.equal(headDoc.contractVersion, CONTRACT_VERSION, "the committed HEAD document must already be migrated");
  assert.equal(isPreMigrationDocument(headDoc), false, "a 1.2.0 document must be rejected by the 1.1.0 guard");

  // Migrating the already-migrated HEAD document is a no-op, so deriving from it
  // would make the byte-identity assertion vacuous. The guard is exactly what
  // forces the real 1.1.0 -> 1.2.0 path to run.
  const noop = migrateStateDocument(headDoc);
  assert.equal(noop.changed, false, "the committed 1.2.0 document must already be migrated, so it must never be the derivation's answer");

  const derived = derivePreMigrationCommit(REPO_ROOT, STATE_REL);
  assert.ok(derived, `no commit in history carries a ${PREVIOUS_CONTRACT_VERSION} ${STATE_REL}`);
  assert.notEqual(derived.sha, headSha(REPO_ROOT), "the guarded derivation must not select HEAD");
  assert.equal(isPreMigrationDocument(derived.doc), true, "the derived document must pass the 1.1.0 guard");
});

test("a mutated migrated document fails the byte-identity reproduction", () => {
  const { expected, committed, pins } = reproduceCommittedMigration(REPO_ROOT, STATE_REL);
  assert.ok(pins > 0, "the migration commit must actually pin at least one artifact");

  // Baseline: the unmutated migration reproduces the migration commit's bytes.
  assert.equal(sha256Hex(Buffer.from(expected)), sha256Hex(Buffer.from(committed)), "the baseline migration must reproduce the migration commit's bytes");

  // Adversarial: one altered gate counter must break byte-identity. If this
  // still matched, the reproduction assertion would be vacuous.
  const mutated = JSON.parse(expected);
  mutated.streams[0].gates.classes.MANDATORY_SOURCE.passed += 1;
  const mutatedRendered = `${JSON.stringify(mutated, null, 2)}\n`;
  assert.notEqual(mutatedRendered, expected, "the mutant must actually change the bytes");
  assert.notEqual(sha256Hex(Buffer.from(mutatedRendered)), sha256Hex(Buffer.from(committed)), "a mutated migrated document must not reproduce the migration commit's bytes");
});

test("the reproduction is stable across later state-path commits (checkout-stability control)", () => {
  // Reproduces the exact defect class: a state-path history of
  // 1.1.0 -> migration commit (1.2.0) -> later transition-like commit(s) that
  // advance registry.revision and re-pin an artifact. The reproduction must
  // still pass, while every working-tree-based comparison must fail.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wf-c05-r2-stability-"));
  try {
    runGit(dir, ["init", "-b", "main"]);
    const artifactRel = "fixture/wf-c05-r2-pinned.txt";
    const v1 = "wf-c05-r2 pinned artifact v1\n";
    const v2 = "wf-c05-r2 pinned artifact v2\n";
    const preMigrationDoc = {
      contractVersion: PREVIOUS_CONTRACT_VERSION,
      registry: { revision: 7 },
      leases: [],
      streams: [
        {
          id: "STAB-01",
          state: "PLANNED",
          git: { worktree: null, branch: "work/stab", baseSha: null, candidateSha: null, integrationSha: null, changedPaths: [], remoteObservation: null },
          gates: { total: 1, passed: 1, failed: 0, blocked: 0, unperformed: 0 },
          review: { qaVerdict: null, qaSessionId: null, auditorVerdict: null, auditorSessionId: null, auditRequired: false },
          corrections: [],
          artifacts: [{ path: artifactRel, sha256: sha256Hex(Buffer.from(v1)) }],
        },
      ],
    };

    writeText(dir, artifactRel, v1);
    writeText(dir, STATE_REL, `${JSON.stringify(preMigrationDoc, null, 2)}\n`);
    commitAll(dir, "pre-migration 1.1.0 document");
    const preSha = headSha(dir);

    const migratedDoc = migrateStateDocument(preMigrationDoc).doc;
    assert.equal(migratedDoc.contractVersion, CONTRACT_VERSION);
    writeText(dir, STATE_REL, `${JSON.stringify(migratedDoc, null, 2)}\n`);
    commitAll(dir, "migration 1.1.0 -> 1.2.0");
    const migrationSha = headSha(dir);

    // A later transition-like commit: revision advances and the pinned artifact
    // is rewritten/re-pinned. The migration commit's own bytes are untouched.
    const laterDoc = JSON.parse(JSON.stringify(migratedDoc));
    laterDoc.registry.revision += 1;
    laterDoc.streams[0].artifacts[0].sha256 = sha256Hex(Buffer.from(v2));
    writeText(dir, artifactRel, v2);
    writeText(dir, STATE_REL, `${JSON.stringify(laterDoc, null, 2)}\n`);
    commitAll(dir, "recorded transition advances the revision");
    const laterSha = headSha(dir);

    const repro = reproduceCommittedMigration(dir, STATE_REL);
    assert.equal(repro.derived.sha, preSha, "the derivation must still find the pre-migration commit");
    assert.equal(repro.migration.sha, migrationSha, "the successor must be the migration commit, not the later transition");
    assert.equal(repro.migration.doc.contractVersion, CONTRACT_VERSION);
    assert.ok(repro.pins > 0, "the migration commit must pin the fixture artifact");
    assert.equal(repro.expected, repro.committed, "the reproduction must pass on a history whose checkout has moved on");

    // The checkout is deliberately AHEAD of the migration commit, so both reads
    // the old implementation performed now diverge from the commit pair.
    const workingState = fs.readFileSync(path.join(dir, ...STATE_REL.split("/")), "utf8");
    const workingArtifact = fs.readFileSync(path.join(dir, ...artifactRel.split("/")));
    assert.equal(headSha(dir), laterSha);
    assert.notEqual(workingState, repro.committed, "the working-tree state must differ from the migration commit's document");
    assert.equal(JSON.parse(workingState).registry.revision, laterDoc.registry.revision, "the working tree carries the later revision");
    assert.notEqual(sha256Hex(workingArtifact), repro.doc.streams[0].artifacts[0].sha256, "the working-tree artifact bytes must differ from the pin used at the migration commit");

    // Explicit failing-first demonstration of the defect class: a working-tree
    // based reproduction must NOT reproduce the migration commit here. If the
    // shared reproduction above ever regressed to reading the workspace, it
    // would fail the same way on this history.
    const workspaceDoc = migrateStateDocument(repro.derived.doc).doc;
    for (const stream of workspaceDoc.streams) {
      for (const artifact of stream.artifacts) {
        artifact.sha256 = sha256Hex(fs.readFileSync(path.join(dir, ...artifact.path.split("/"))));
      }
    }
    const workspaceExpected = `${JSON.stringify(workspaceDoc, null, 2)}\n`;
    assert.notEqual(sha256Hex(Buffer.from(workingState)), sha256Hex(Buffer.from(repro.committed)), "a working-tree state comparison must fail");
    assert.notEqual(sha256Hex(Buffer.from(workspaceExpected)), sha256Hex(Buffer.from(repro.committed)), "a working-tree pin comparison must fail");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the derivation fails when no 1.1.0 document exists in history", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wf-c05-r2-no-pre-"));
  try {
    runGit(dir, ["init", "-b", "main"]);
    const alreadyMigrated = { contractVersion: CONTRACT_VERSION, registry: { revision: 3 }, leases: [], streams: [] };
    writeText(dir, STATE_REL, `${JSON.stringify(alreadyMigrated, null, 2)}\n`);
    commitAll(dir, "already-migrated document only");

    assert.equal(derivePreMigrationCommit(dir, STATE_REL), null, "a history without a 1.1.0 document must derive nothing");
    assert.throws(
      () => reproduceCommittedMigration(dir, STATE_REL),
      /no commit in history carries a 1\.1\.0/,
      "the reproduction must fail loudly instead of comparing a non-existent pair",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
