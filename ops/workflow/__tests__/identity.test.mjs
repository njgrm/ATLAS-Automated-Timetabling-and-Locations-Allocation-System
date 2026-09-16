// A1 — non-self-referential closure identity.
//
// A remote observation attests a named ref and the SHA observed there. It is a
// snapshot, never an invariant that a committed field must equal the commit that
// contains it, so recording one cannot create a "new final SHA" fix-up chain.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getSharedRepo,
  createTempRepo,
  cleanupRepo,
  git,
  sha256,
  stateDocFromFixture,
  writeStateDoc,
  verifyInProcess,
  SCHEMA_FILE,
} from "./harness.mjs";
import { migrateStateDocument } from "../lib/migrate.mjs";

const ISO = "2026-09-14T10:00:00+08:00";

function observedValue(sha, ref = "refs/remotes/origin/main") {
  return { ref, sha, observedAt: ISO, kind: "REMOTE_TRACKING_REF" };
}

function codes(result) {
  return result.errors.map((e) => e.code);
}

test("an observation may be an ancestor of the tip and never needs a follow-up commit", () => {
  const repo = createTempRepo();
  try {
    const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
      d.streams[0].git.baseSha = repo.baseSha;
      d.streams[0].git.candidateSha = repo.candidateSha;
      d.streams[0].git.integrationSha = repo.integrationSha;
      d.streams[0].git.changedPaths = ["candidate.txt"];
      d.streams[0].git.remoteObservation = observedValue(repo.integrationSha);
    });
    const statePath = writeStateDoc(repo, "identity-stable.json", doc);

    const first = verifyInProcess(statePath);
    assert.equal(first.ok, true, JSON.stringify(first.errors));

    // Advance the branch tip, exactly as the closure commit would. The recorded
    // observation is now an ancestor of the tip, and the same bytes still
    // verify: no "final SHA" fix-up commit is required.
    fs.writeFileSync(path.join(repo.dir, "tip.txt"), "tip\n");
    git(repo.dir, ["add", "tip.txt"]);
    git(repo.dir, ["-c", "user.name=WF-C02", "-c", "user.email=wfc02@example.invalid", "-c", "commit.gpgsign=false", "commit", "-m", "closure commit"]);

    const second = verifyInProcess(statePath);
    assert.equal(second.ok, true, JSON.stringify(second.errors));
    const bytesBefore = sha256(fs.readFileSync(statePath));
    verifyInProcess(statePath);
    assert.equal(sha256(fs.readFileSync(statePath)), bytesBefore, "verification must not rewrite the observation");
  } finally {
    cleanupRepo(repo.dir);
  }
});

test("a forged remote observation fails closed", () => {
  const repo = getSharedRepo();

  const unrelated = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.streams[0].git.baseSha = repo.baseSha;
    d.streams[0].git.candidateSha = repo.candidateSha;
    d.streams[0].git.integrationSha = repo.integrationSha;
    d.streams[0].git.changedPaths = ["candidate.txt"];
    d.streams[0].git.remoteObservation = observedValue(repo.otherSha);
  });
  const unrelatedResult = verifyInProcess(writeStateDoc(repo, "identity-forged-branch.json", unrelated));
  assert.equal(unrelatedResult.ok, false);
  assert.ok(codes(unrelatedResult).includes("REMOTE_OBSERVATION_INVALID"), JSON.stringify(codes(unrelatedResult)));

  const nonexistent = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.streams[0].git.baseSha = repo.baseSha;
    d.streams[0].git.candidateSha = repo.candidateSha;
    d.streams[0].git.integrationSha = repo.integrationSha;
    d.streams[0].git.changedPaths = ["candidate.txt"];
    d.streams[0].git.remoteObservation = observedValue("0".repeat(40));
  });
  const nonexistentResult = verifyInProcess(writeStateDoc(repo, "identity-forged-sha.json", nonexistent));
  assert.equal(nonexistentResult.ok, false);
  assert.ok(codes(nonexistentResult).includes("REMOTE_OBSERVATION_INVALID"), JSON.stringify(codes(nonexistentResult)));
});

test("stale candidate/integration ancestry still fails closed", () => {
  const repo = getSharedRepo();
  const stale = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.streams[0].git.baseSha = repo.otherSha;
    d.streams[0].git.candidateSha = repo.candidateSha;
    d.streams[0].git.integrationSha = repo.integrationSha;
    d.streams[0].git.changedPaths = ["candidate.txt"];
    d.streams[0].git.remoteObservation = null;
  });
  const result = verifyInProcess(writeStateDoc(repo, "identity-stale.json", stale));
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes("GIT_ANCESTRY"), JSON.stringify(codes(result)));
});

test("the legacy remoteSha self-reference is not expressible in the contract", () => {
  const raw = fs.readFileSync(SCHEMA_FILE, "utf8");
  assert.equal(/"remoteSha"/.test(raw), false);
  const schema = JSON.parse(raw);
  assert.equal(schema.$defs.git.required.includes("remoteObservation"), true);
  assert.equal(schema.$defs.git.required.includes("remoteSha"), false);
  // There is no rule tying any committed SHA to the containing HEAD.
  const verifySource = fs.readFileSync(path.join(path.dirname(SCHEMA_FILE), "..", "lib", "verify.mjs"), "utf8");
  assert.equal(/rev-parse HEAD/.test(verifySource), false, "the verifier must not compare state SHAs against HEAD");
});

test("migration preserves every historical identity and drops the ambiguous scalar", () => {
  const repo = getSharedRepo();
  const legacy = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.contractVersion = "1.0.0";
    delete d.registry.revision;
    delete d.leases;
    // A 1.0.0 document predates the lease contract, so it cannot carry live
    // evidence for a RUNNING declaration: the migrated document must not claim
    // RUNNING without one (RUNNING_WITHOUT_LIVE_EVIDENCE).
    d.streams[0].state = "PLANNED";
    d.streams[0].running = [];
    d.streams[0].git.baseSha = repo.baseSha;
    d.streams[0].git.candidateSha = repo.candidateSha;
    d.streams[0].git.integrationSha = repo.integrationSha;
    d.streams[0].git.changedPaths = ["candidate.txt"];
    d.streams[0].git.remoteSha = repo.integrationSha;
    delete d.streams[0].git.remoteObservation;
  });

  const { doc, changed, changes } = migrateStateDocument(legacy);
  assert.equal(changed, true);
  assert.ok(changes.length > 0);
  assert.equal(doc.contractVersion, "1.2.0");
  assert.equal(doc.registry.revision, 1);
  assert.deepEqual(doc.leases, []);
  const gitBlock = doc.streams[0].git;
  assert.equal(Object.prototype.hasOwnProperty.call(gitBlock, "remoteSha"), false);
  assert.equal(gitBlock.remoteObservation.sha, repo.integrationSha);
  assert.equal(gitBlock.baseSha, repo.baseSha);
  assert.equal(gitBlock.candidateSha, repo.candidateSha);
  assert.equal(gitBlock.integrationSha, repo.integrationSha);
  // The migrated document is verifier-clean.
  const result = verifyInProcess(writeStateDoc(repo, "identity-migrated.json", doc));
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});
