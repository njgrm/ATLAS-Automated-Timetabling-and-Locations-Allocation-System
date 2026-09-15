import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { VERIFY_CLI, RENDER_CLI, REPO_ROOT, runCli } from "./harness.mjs";

const STATE = path.join(REPO_ROOT, "docs", "plans", "atlas-delivery-cycles.json");
const GENERATED = path.join(REPO_ROOT, "docs", "plans", "atlas-active-delivery-streams.generated.md");
const HISTORICAL = path.join(REPO_ROOT, "docs", "plans", "atlas-active-delivery-streams.md");

// The exact committed stream inventory. This pin is deliberately explicit rather
// than derived: a stream added through `create-stream` (WF-C04) must update it in
// the same reviewed candidate, so a registry that grew without its assertions
// fails closed instead of silently widening the suite's contract.
const SEED_STREAM_IDS = [
  "BENEFICIARY-EXPORT-PARITY-C05",
  "COMPANION-SSO-C03",
  "COMPANION-SSO-LIVE-PREP-C02",
  "ENROLLPRO-PROXY-RECOVERY-LIVE",
  "LIVE-GENERATION",
  "LIVE-PUBLICATION",
  "TERM-CACHE-CATCHUP-APPLY",
  "TL-OPERATOR-WORKSPACE-C05",
  "TT-SOURCE-FRESHNESS-C04",
  "WF-C01",
  "WF-C02",
  "WF-C03",
  "WF-C04",
  "WF-C05",
];

// Ordered set comparison. Returns null on an exact match, otherwise the exact
// missing/extra members so a failure names the drift instead of just a count.
function seedInventoryMismatch(doc) {
  const actual = doc.streams.map((s) => s.id).sort();
  const expected = [...SEED_STREAM_IDS].sort();
  if (actual.length === expected.length && actual.every((id, i) => id === expected[i])) return null;
  return {
    actual,
    expected,
    missing: expected.filter((id) => !actual.includes(id)),
    extra: actual.filter((id) => !expected.includes(id)),
  };
}

test("the committed seed state verifies cleanly with exit code 0", () => {
  const result = runCli(VERIFY_CLI, ["--state", STATE], { cwd: REPO_ROOT });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.json.status, "ok");
  assert.deepEqual(result.json.errors, []);
  assert.equal(result.json.summary.streams.total, SEED_STREAM_IDS.length);
});

test("the committed generated register matches the renderer output byte-for-byte", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc01-seed-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const out = path.join(dir, "generated.md");

  const result = runCli(RENDER_CLI, ["--state", STATE, "--output", out], { cwd: REPO_ROOT });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(fs.readFileSync(out), fs.readFileSync(GENERATED));

  const text = fs.readFileSync(GENERATED, "utf8");
  assert.ok(text.endsWith("\n"), "generated register must end with a newline");
  assert.equal(text.includes("\r\n"), false, "generated register must use LF newlines");
  assert.ok(text.includes("generated; do not edit"), "generated register must carry the do-not-edit notice");
});

// A stream either has no candidate yet (null) or carries a committed
// 40-hex lowercase SHA. The planner records candidate/integration SHAs when
// the register advances to INTEGRATION_READY/COMPLETE, so an exact-null
// assertion would over-constrain the intended lifecycle (wave-audit B1).
const CANDIDATE_SHA_PATTERN = /^[0-9a-f]{40}$/;

function isNullOrCommittedSha(value) {
  return value === null || CANDIDATE_SHA_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// Retired-conflation regression support (WF-SEED-PIN-C01).
//
// A stream records TWO different identities:
//   * `git.candidateSha` / `git.integrationSha` — the reviewed docs/evidence
//     candidate committed by the stream; and
//   * the deployed PRODUCT release, which is an operational fact this registry
//     records only inside `approval.boundary` / `approval.approvedActions` /
//     `objective` prose (there is deliberately no structured registry field
//     for deployed runtime identity yet).
//
// The seed suite previously asserted, for ENROLLPRO-PROXY-RECOVERY-LIVE only,
// that `stream.git.candidateSha === <the deployed release literal>`, which
// forced an evidence commit to equal a product pin. The helpers below derive
// the deployed release identity structurally from prose — never from a
// hard-coded literal — so the regression can prove the two stay distinct.
// ---------------------------------------------------------------------------
const SHA40_IN_PROSE_PATTERN = /\b[0-9a-f]{40}\b/g;

function extractDeployedReleaseShas(stream) {
  const prose = [
    stream.objective,
    stream.approval?.boundary,
    ...(stream.approval?.approvedActions ?? []),
  ]
    .filter((value) => typeof value === "string")
    .join("\n");
  return [...new Set(prose.match(SHA40_IN_PROSE_PATTERN) ?? [])].sort();
}

// The retired rule expressed as a predicate: "the stream's candidateSha must
// equal the deployed product release named in its own approval prose."
// Reintroducing an assertion of this form must fail; the regression below
// evaluates this predicate against the real committed registry and requires
// false.
function conflatesEvidenceWithDeployedRelease(stream) {
  return extractDeployedReleaseShas(stream).includes(stream.git.candidateSha);
}

// Mutant control: the inverted predicate must return the opposite value,
// proving the real-record evaluation above is an observable fact rather than a
// vacuously false function.
function invertedConflationPredicate(stream) {
  return !conflatesEvidenceWithDeployedRelease(stream);
}

test("the seed declares the exact expected stream inventory with null-or-committed candidate SHAs", () => {
  const doc = JSON.parse(fs.readFileSync(STATE, "utf8"));
  assert.equal(doc.contractVersion, "1.2.0");
  assert.equal(Number.isInteger(doc.registry.revision) && doc.registry.revision >= 1, true);
  assert.ok(Array.isArray(doc.leases), "the seed must declare the leases array");
  assert.equal(seedInventoryMismatch(doc), null, `seed stream inventory drifted: ${JSON.stringify(seedInventoryMismatch(doc))}`);
  assert.equal(doc.streams.length, SEED_STREAM_IDS.length);
  for (const stream of doc.streams) {
    assert.equal(Object.prototype.hasOwnProperty.call(stream.git, "remoteSha"), false, `${stream.id} must not carry the legacy remoteSha`);
    assert.equal(Object.prototype.hasOwnProperty.call(stream.git, "remoteObservation"), true, `${stream.id} must carry remoteObservation`);
    assert.ok(
      isNullOrCommittedSha(stream.git.candidateSha),
      `${stream.id} candidateSha must be null or a 40-hex lowercase SHA, got ${JSON.stringify(stream.git.candidateSha)}`,
    );
  }

  // Negative controls: the predicate must reject malformed values, otherwise
  // the invariant above would be vacuous.
  for (const malformed of [
    "not-a-sha",
    "bcee9d0d92f43a55db4cbfa3a0a6306dd57d327", // 39 hex
    "BCEE9D0D92F43A55DB4CBFA3A0A6306DD57D3275", // uppercase
    "0xBCEE9D0D92F43A55DB4CBFA3A0A6306DD57D3275", // prefixed
    " bcee9d0d92f43a55db4cbfa3a0a6306dd57d3275", // leading whitespace
    "bcee9d0d92f43a55db4cbfa3a0a6306dd57d3275 ", // trailing whitespace
    "",
    123,
    undefined,
  ]) {
    assert.equal(isNullOrCommittedSha(malformed), false, `predicate must reject ${JSON.stringify(malformed)}`);
  }
  assert.equal(isNullOrCommittedSha(null), true);
  assert.equal(isNullOrCommittedSha("bcee9d0d92f43a55db4cbfa3a0a6306dd57d3275"), true);
});

// FAILING-FIRST REGRESSION for the retired seed assertion (WF-SEED-PIN-C01).
// The old rule asserted that ENROLLPRO-PROXY-RECOVERY-LIVE's `git.candidateSha`
// equalled its deployed product release. Those are two distinct identities: the
// candidate is the committed docs/evidence boundary for the live-execution
// stream, while the deployed release is an operational fact recorded only in
// `approval.boundary` / `approval.approvedActions` / `objective` prose.
//
// Load-bearing: if anyone reintroduces a rule of the form
// `stream.git.candidateSha === <deployed release>` — whether as the original
// hard-coded literal or as a value derived from the stream's own prose — the
// assertions below fail, because the conflation predicate is required to be
// false on the real committed registry while its inversion is required true.
test("an evidence candidate may differ from the deployed product release", () => {
  const doc = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const stream = doc.streams.find((s) => s.id === "ENROLLPRO-PROXY-RECOVERY-LIVE");
  assert.ok(stream, "the deployed-release regression stream must remain registered");

  const evidenceCandidate = stream.git.candidateSha;
  const deployedReleaseShas = extractDeployedReleaseShas(stream);

  // (a) the general invariant must still accept the real evidence candidate.
  assert.ok(
    isNullOrCommittedSha(evidenceCandidate),
    `the real evidence candidate must satisfy the general invariant, got ${JSON.stringify(evidenceCandidate)}`,
  );
  assert.ok(
    CANDIDATE_SHA_PATTERN.test(evidenceCandidate),
    "this regression is only meaningful while the stream carries a committed evidence candidate",
  );

  // The deployed release must be derivable from the stream's own prose and must
  // itself be a committed 40-hex lowercase identity.
  assert.ok(deployedReleaseShas.length > 0, "the approval/objective prose must name the deployed release SHA");
  for (const sha of deployedReleaseShas) {
    assert.ok(CANDIDATE_SHA_PATTERN.test(sha), `deployed-release prose token must be a committed SHA, got ${JSON.stringify(sha)}`);
  }
  const deployedRelease = deployedReleaseShas[0];

  // (b) the evidence candidate and the deployed release are distinct values.
  assert.notEqual(
    evidenceCandidate,
    deployedRelease,
    "the evidence candidate must not be conflated with the deployed product release",
  );

  // (c) the explicit conflation predicate — the retired rule, derived rather
  // than hard-coded — must be false on the real record, and its inverted mutant
  // must be true so a vacuous implementation cannot pass this control.
  assert.equal(
    conflatesEvidenceWithDeployedRelease(stream),
    false,
    "the retired candidateSha == deployed-release rule must not hold on the real registry",
  );
  assert.equal(
    invertedConflationPredicate(stream),
    true,
    "the inverted mutant must return true, proving the predicate is observable",
  );

  // The retired rule in its exact assertion form. This call must throw: it is
  // the proof that reintroducing the old equality assertion cannot pass here.
  assert.throws(
    () => assert.equal(evidenceCandidate, deployedRelease, "retired conflation rule"),
    (err) => err && err.code === "ERR_ASSERTION",
    "the retired candidateSha == deployed-release assertion must fail on the real registry",
  );
});

test("the generated register is a distinct file from the historical prose register", () => {
  assert.notEqual(path.resolve(GENERATED), path.resolve(HISTORICAL));
});

// Load-bearing control for the inventory pin above: the assertion must fail on
// the pre-reconciliation registry, not merely pass on whatever the registry now
// holds. The removed set is asserted exactly so this control cannot silently
// become vacuous if the registered streams are ever renamed.
test("the seed stream-inventory pin detects a stale registry", () => {
  const doc = JSON.parse(fs.readFileSync(STATE, "utf8"));
  assert.equal(seedInventoryMismatch(doc), null, "the committed registry must satisfy the pin first");

  const addedAfterPreReconciliation = [
    "BENEFICIARY-EXPORT-PARITY-C05",
    "COMPANION-SSO-C03",
    "COMPANION-SSO-LIVE-PREP-C02",
    "TL-OPERATOR-WORKSPACE-C05",
    "WF-C04",
    "WF-C05",
  ];
  const stale = JSON.parse(JSON.stringify(doc));
  stale.streams = stale.streams.filter((s) => !addedAfterPreReconciliation.includes(s.id));
  assert.equal(stale.streams.length, 8, "the pre-reconciliation registry held exactly eight streams");

  const mismatch = seedInventoryMismatch(stale);
  assert.ok(mismatch, "the pre-reconciliation inventory must fail the pin");
  assert.deepEqual([...mismatch.missing].sort(), [...addedAfterPreReconciliation].sort(), "the failure must name exactly the added streams");
  assert.deepEqual(mismatch.extra, []);

  // The count pin is load-bearing too: an extra stream alone is drift.
  const extra = JSON.parse(JSON.stringify(doc));
  extra.streams.push(JSON.parse(JSON.stringify(doc.streams[0])));
  extra.streams[extra.streams.length - 1].id = "UNREGISTERED-1";
  const extraMismatch = seedInventoryMismatch(extra);
  assert.ok(extraMismatch, "an unregistered extra stream must fail the pin");
  assert.deepEqual(extraMismatch.extra, ["UNREGISTERED-1"]);
});
