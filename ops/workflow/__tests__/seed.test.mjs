// WF-SEED-INVENTORY-C02 — generic registry contract for the committed seed.
//
// The previous revision of this file pinned the COMPLETE evolving production
// stream inventory as an exact-equality list (`SEED_STREAM_IDS`). Because
// `ops/workflow/transition.mjs --transition create-stream` appends a registry
// record with no knowledge of this test, every registration made the suite red
// until unrelated test source was edited by hand. The defect is test-level only:
// the production verifier (`ops/workflow/lib/verify.mjs`) is already generic over
// `streams[]`.
//
// The correction therefore:
//   * retires the exact-equality pin (§A) and keeps the retired rule only as an
//     inert, frozen historical constant that powers a failing-first control;
//   * adds a genuinely immutable five-stream core baseline asserted as a subset
//     (§B);
//   * guards mechanically that no live registered stream id is re-enumerated as
//     a quoted literal in this source (§C);
//   * drives the REAL production verifier generically over every registered
//     stream with one mutation per invariant family and per-stream assertions on
//     the exact (code, path) pair (§D);
//   * proves, through the real `create-stream` operation, that a stream added
//     after this source was written keeps verify and render green with no source
//     edit and never rewrites the committed generated register (§E);
//   * repeats negative mutants on that newly created stream (§F).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA_FILE, VERIFY_CLI, RENDER_CLI, REPO_ROOT, runCli } from "./harness.mjs";
import { createGitMemo, runGit } from "../lib/git.mjs";
import { verifyStateDocument } from "../lib/verify.mjs";
import { renderRegister } from "../lib/render.mjs";
import { sha256Hex } from "../lib/util.mjs";
import { runTransition } from "../lib/transition.mjs";

const STATE = path.join(REPO_ROOT, "docs", "plans", "atlas-delivery-cycles.json");
const GENERATED = path.join(REPO_ROOT, "docs", "plans", "atlas-active-delivery-streams.generated.md");
const HISTORICAL = path.join(REPO_ROOT, "docs", "plans", "atlas-active-delivery-streams.md");
const SELF = fileURLToPath(import.meta.url);

// One read-only Git memo shared by every verifier call in this file, including
// the real transition below. Every entry is keyed by its exact query, so sharing
// it only resolves an unchanged Git fact once; it never weakens an assertion.
const GIT_MEMO = createGitMemo();

// The transition engine and the observation-expiry rule both need a stable
// reference instant for the in-memory mutants. A pinned instant keeps the
// expiry controls deterministic without depending on the wall clock.
const FAMILY_NOW = new Date("2026-09-16T00:00:00.000Z");
const PROBE_NOW = "2026-09-16T00:00:00.000Z";

function readStateDoc() {
  return JSON.parse(fs.readFileSync(STATE, "utf8"));
}

function cloneDoc(value) {
  return JSON.parse(JSON.stringify(value));
}

// The canonical serialization the atomic transition engine writes.
function docBytes(doc) {
  return Buffer.from(`${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

// ---------------------------------------------------------------------------
// §A Retired exact-equality pin (inert history + failing-first control).
//
// The complete inventory pinned at the retirement commit (17 ids). This list is
// history: it is never updated and never asserted as an equality against the live
// registry. It exists only so the retired rule below can be evaluated and shown
// to reject both the committed registry and a registry enlarged by a real
// `create-stream` — which is exactly the defect this stream removes.
const RETIRED_PINNED_INVENTORY = Object.freeze([
  "BENEFICIARY-EXPORT-PARITY-C05",
  "COMPANION-SSO-C03",
  "COMPANION-SSO-LIVE-PREP-C02",
  "ENROLLPRO-PROXY-RECOVERY-LIVE",
  "LIVE-GENERATION",
  "LIVE-PUBLICATION",
  "TERM-CACHE-CATCHUP-APPLY",
  "TERM-CACHE-CATCHUP-APPLY-REFRESH-C01",
  "TL-DIAGNOSTICS-LOADING-C06",
  "TL-OPERATOR-WORKSPACE-C05",
  "TT-SOURCE-FRESHNESS-C04",
  "WF-C01",
  "WF-C02",
  "WF-C03",
  "WF-C04",
  "WF-C05",
  "WF-SEED-PIN-C01",
]);

// The retired rule, verbatim in behaviour: ordered set comparison returning null
// on an exact match, else the exact missing/extra members. It MUST reject the
// current registry (that is why the old design was red) and it MUST keep
// rejecting the registry after a stream is added through the real create-stream
// operation.
function retiredExactInventoryMismatch(doc) {
  const actual = doc.streams.map((s) => s.id).sort();
  const expected = [...RETIRED_PINNED_INVENTORY].sort();
  if (actual.length === expected.length && actual.every((id, i) => id === expected[i])) return null;
  return {
    actual,
    expected,
    missing: expected.filter((id) => !actual.includes(id)),
    extra: actual.filter((id) => !expected.includes(id)),
  };
}

// ---------------------------------------------------------------------------
// §B Immutable core baseline (subset, never equality).
//
// The five streams present in the register's first committed revision (seed
// commit 1790cbc0). Registry records are retained forever, so losing one of these
// is registry corruption rather than legitimate churn. This baseline must not be
// extended with ordinary stream ids.
const CORE_STREAM_IDS = Object.freeze([
  "ENROLLPRO-PROXY-RECOVERY-LIVE",
  "LIVE-GENERATION",
  "LIVE-PUBLICATION",
  "TT-SOURCE-FRESHNESS-C04",
  "WF-C01",
]);

function coreInventoryMismatch(doc) {
  const present = new Set(doc.streams.map((s) => s.id));
  const missing = CORE_STREAM_IDS.filter((id) => !present.has(id));
  return missing.length === 0 ? null : { missing };
}

// ---------------------------------------------------------------------------
// SHA-shape predicate (preserved from the previous revision).
//
// A stream either has no candidate yet (null) or carries a committed 40-hex
// lowercase SHA. The planner records candidate/integration SHAs when the
// register advances to INTEGRATION_READY/COMPLETE, so an exact-null assertion
// would over-constrain the intended lifecycle (wave-audit B1).
const CANDIDATE_SHA_PATTERN = /^[0-9a-f]{40}$/;

function isNullOrCommittedSha(value) {
  return value === null || CANDIDATE_SHA_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// Retired-conflation regression support (WF-SEED-PIN-C01, preserved).
//
// A stream records TWO different identities:
//   * `git.candidateSha` / `git.integrationSha` — the reviewed docs/evidence
//     candidate committed by the stream; and
//   * the deployed PRODUCT release, which is an operational fact this registry
//     records only inside `approval.boundary` / `approval.approvedActions` /
//     `objective` prose (there is deliberately no structured registry field for
//     deployed runtime identity yet).
//
// The seed suite previously asserted, for ENROLLPRO-PROXY-RECOVERY-LIVE only,
// that `stream.git.candidateSha === <the deployed release literal>`, which forced
// an evidence commit to equal a product pin. The helpers below derive the
// deployed release identity structurally from prose — never from a hard-coded
// literal — so the regression can prove the two stay distinct.
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

// Mutant control: the inverted predicate must return the opposite value, proving
// the real-record evaluation above is an observable fact rather than a vacuously
// false function.
function invertedConflationPredicate(stream) {
  return !conflatesEvidenceWithDeployedRelease(stream);
}

// ---------------------------------------------------------------------------
// §D Generic per-stream invariant families.
//
// Each family mutates one committed document in memory and returns the exact
// (code, path) pairs the production verifier must report, one per APPLICABLE
// stream. Every mutated document stays schema-valid apart from the family under
// test, because a structural schema violation makes the verifier return early
// with only schema errors. Lease and observation records are therefore
// schema-complete.
const ZERO_COUNTERS = Object.freeze({ total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 });

function zeroCounters() {
  return { ...ZERO_COUNTERS };
}

function zeroGates() {
  return {
    ...zeroCounters(),
    plan: { MANDATORY_SOURCE: 0, MANDATORY_LIVE: 0, DEFERRED_EXTERNAL: 0 },
    classes: {
      MANDATORY_SOURCE: zeroCounters(),
      MANDATORY_LIVE: zeroCounters(),
      DEFERRED_EXTERNAL: zeroCounters(),
    },
  };
}

function makeActiveLease(index, streamId) {
  return {
    id: `family-lease-${index}`,
    streamId,
    worktree: null,
    role: "executor",
    sessionId: `family-session-${index}`,
    state: "ACTIVE",
    revision: 1,
    updatedAt: PROBE_NOW,
    expiresAt: null,
  };
}

function makeObservation(status, expiresAt) {
  return {
    id: "obs-probe",
    target: "the invariant-family probe target",
    checkedAt: PROBE_NOW,
    status,
    expiresAt,
    detail: "invariant-family probe",
  };
}

const FAMILIES = [
  {
    name: "duplicate stream id",
    apply(doc) {
      const originalCount = doc.streams.length;
      doc.streams.push(...cloneDoc(doc.streams));
      return doc.streams
        .slice(0, originalCount)
        .map((_, i) => ({ code: "DUPLICATE_STREAM_ID", path: `streams[${originalCount + i}].id` }));
    },
  },
  {
    name: "malformed candidate SHA",
    apply(doc) {
      for (const stream of doc.streams) stream.git.candidateSha = "not-a-sha";
      return doc.streams.map((_, i) => ({ code: "SCHEMA_PATTERN", path: `$.streams[${i}].git.candidateSha` }));
    },
  },
  {
    name: "missing remote observation key",
    apply(doc) {
      for (const stream of doc.streams) delete stream.git.remoteObservation;
      return doc.streams.map((_, i) => ({ code: "SCHEMA_REQUIRED", path: `$.streams[${i}].git` }));
    },
  },
  {
    name: "missing required lifecycle field",
    apply(doc) {
      for (const stream of doc.streams) delete stream.owners;
      return doc.streams.map((_, i) => ({ code: "SCHEMA_REQUIRED", path: `$.streams[${i}]` }));
    },
  },
  {
    name: "invalid state value",
    apply(doc) {
      for (const stream of doc.streams) stream.state = "NOT_A_STATE";
      return doc.streams.map((_, i) => ({ code: "SCHEMA_ENUM", path: `$.streams[${i}].state` }));
    },
  },
  {
    name: "gate arithmetic drift",
    apply(doc) {
      for (const stream of doc.streams) stream.gates.passed += 1;
      return doc.streams.map((_, i) => ({ code: "GATES_ARITHMETIC", path: `streams[${i}].gates` }));
    },
  },
  {
    name: "COMPLETE without ACCEPT_READY QA",
    apply(doc) {
      for (const stream of doc.streams) {
        stream.state = "COMPLETE";
        stream.review.qaVerdict = null;
      }
      return doc.streams.map((_, i) => ({ code: "COMPLETE_MISSING_QA", path: `streams[${i}].review.qaVerdict` }));
    },
  },
  {
    name: "COMPLETE without audit verdict",
    apply(doc) {
      for (const stream of doc.streams) {
        stream.state = "COMPLETE";
        stream.review.auditRequired = true;
        stream.review.auditorVerdict = null;
      }
      return doc.streams.map((_, i) => ({ code: "COMPLETE_MISSING_AUDIT", path: `streams[${i}].review` }));
    },
  },
  {
    name: "COMPLETE without closure receipt",
    apply(doc) {
      for (const stream of doc.streams) {
        stream.state = "COMPLETE";
        stream.closure = null;
      }
      return doc.streams.map((_, i) => ({ code: "COMPLETE_MISSING_RECEIPT", path: `streams[${i}].closure.receipt` }));
    },
  },
  {
    name: "terminal stream with a live lease",
    apply(doc) {
      for (const stream of doc.streams) stream.state = "COMPLETE";
      doc.leases = doc.streams.map((stream, i) => makeActiveLease(i, stream.id));
      return doc.leases.map((_, i) => ({ code: "COMPLETE_WITH_LIVE_LEASE", path: `leases[${i}].state` }));
    },
  },
  {
    name: "PLANNED stream with a live lease",
    apply(doc) {
      for (const stream of doc.streams) {
        stream.state = "PLANNED";
        stream.running = [];
      }
      doc.leases = doc.streams.map((stream, i) => makeActiveLease(i, stream.id));
      return doc.streams.map((_, i) => ({ code: "PLANNED_WITH_LIVE_LEASE", path: `streams[${i}].state` }));
    },
  },
  {
    name: "unknown candidate commit",
    apply(doc) {
      const expected = [];
      doc.streams.forEach((stream, i) => {
        if (stream.git.candidateSha === null) return;
        stream.git.candidateSha = "0".repeat(40);
        expected.push({ code: "GIT_SHA_UNKNOWN", path: `streams[${i}].git` });
      });
      return expected;
    },
  },
  {
    name: "tampered closure receipt",
    apply(doc) {
      const expected = [];
      doc.streams.forEach((stream, i) => {
        // The verifier validates a closure receipt only for a COMPLETE stream.
        if (stream.state !== "COMPLETE" || !stream.closure || !stream.closure.receipt) return;
        stream.closure.receipt.sha256 = "0".repeat(64);
        expected.push({ code: "RECEIPT_INVALID", path: `streams[${i}].closure.receipt` });
      });
      return expected;
    },
  },
  {
    name: "unknown remote observation",
    apply(doc) {
      const expected = [];
      doc.streams.forEach((stream, i) => {
        if (stream.git.remoteObservation === null) return;
        stream.git.remoteObservation.sha = "0".repeat(40);
        expected.push({ code: "REMOTE_OBSERVATION_INVALID", path: `streams[${i}].git.remoteObservation.sha` });
      });
      return expected;
    },
  },
  {
    name: "missing required observation",
    now: FAMILY_NOW,
    apply(doc) {
      for (const stream of doc.streams) {
        stream.approval.presentedReady = true;
        stream.approval.requiredObservationIds = ["obs-probe"];
        stream.observations = [];
      }
      return doc.streams.map((_, i) => ({ code: "HIGH_DEPENDENCY_MISSING", path: `streams[${i}].approval.requiredObservationIds` }));
    },
  },
  {
    name: "unhealthy required observation",
    now: FAMILY_NOW,
    apply(doc) {
      for (const stream of doc.streams) {
        stream.approval.presentedReady = true;
        stream.approval.requiredObservationIds = ["obs-probe"];
        stream.observations = [makeObservation("FAIL", "2030-01-01T00:00:00.000Z")];
      }
      return doc.streams.map((_, i) => ({ code: "HIGH_DEPENDENCY_UNHEALTHY", path: `streams[${i}].observations` }));
    },
  },
  {
    name: "expired required observation",
    now: FAMILY_NOW,
    apply(doc) {
      for (const stream of doc.streams) {
        stream.approval.presentedReady = true;
        stream.approval.requiredObservationIds = ["obs-probe"];
        stream.observations = [makeObservation("PASS", "2020-01-01T00:00:00.000Z")];
      }
      return doc.streams.map((_, i) => ({ code: "HIGH_DEPENDENCY_EXPIRED", path: `streams[${i}].observations` }));
    },
  },
];

// ---------------------------------------------------------------------------
// §E Probe fixture: a real `create-stream` against a clone of the committed
// registry, inside a Git-ignored temp fixture in this worktree.
//
// The clone must live INSIDE the repository so `resolveRepoRoot` resolves the
// real repository and the referenced commits/artifacts resolve. The transition
// is given an ABSOLUTE `--render` path inside the fixture; without it the
// transition would republish the committed generated register.
let probeFixture = null;

test.after(() => {
  if (probeFixture?.dir) fs.rmSync(probeFixture.dir, { recursive: true, force: true });
});

function buildProbeFixture() {
  const committed = readStateDoc();
  const committedBytes = fs.readFileSync(STATE);
  const originMain = runGit(["rev-parse", "origin/main"], REPO_ROOT).stdout.trim();
  assert.match(originMain, CANDIDATE_SHA_PATTERN, "origin/main must resolve to a committed SHA for the probe");

  const dir = fs.mkdtempSync(path.join(REPO_ROOT, "docs", ".wf-seed-inventory-"));
  const clonePath = path.join(dir, "state.json");
  const renderPath = path.join(dir, "generated.md");
  fs.writeFileSync(clonePath, committedBytes);

  // Template the spec from the registry's own pre-candidate shape: the first
  // record in document order whose git.candidateSha is null.
  const template = committed.streams.find((stream) => stream.git.candidateSha === null);
  assert.ok(template, "the registry must carry at least one pre-candidate record to template the probe");

  const createdId = `E2E-PROBE-R${committed.registry.revision}`;
  const spec = cloneDoc(template);
  spec.id = createdId;
  spec.kind = "STREAM";
  spec.riskTier = "LOW";
  spec.state = "PLANNED";
  spec.stateUpdatedAt = PROBE_NOW;
  spec.nextAction = "Await review of the create-stream probe.";
  spec.awaited = [];
  spec.running = [];
  spec.git = {
    worktree: null,
    branch: "work/wf-seed-inventory-probe",
    baseSha: originMain,
    candidateSha: null,
    integrationSha: null,
    changedPaths: [],
    remoteObservation: null,
  };
  spec.owners = {
    planner: { sessionId: null, status: "NONE", writable: false },
    executor: { sessionId: null, status: "NONE", writable: false },
    qa: { sessionId: null, status: "NONE", writable: false },
    auditor: { sessionId: null, status: "NONE", writable: false },
  };
  spec.gates = zeroGates();
  spec.review = { qaVerdict: null, qaSessionId: null, auditorVerdict: null, auditorSessionId: null, auditRequired: false, qaRounds: [] };
  spec.corrections = [];
  spec.successors = [];
  spec.requires = [];
  spec.observations = [];
  spec.artifacts = [];
  spec.closure = null;
  spec.blocker = { kind: "NONE", detail: "", safeWorkRemaining: false, safeWorkItems: [] };
  spec.approval = {
    required: false,
    presentedReady: false,
    granted: false,
    operatorIdentity: null,
    approvedAt: null,
    boundary: null,
    approvedActions: [],
    requiredObservationIds: [],
    execution: null,
  };
  const specPath = path.join(dir, "spec.json");
  fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);

  const flags = {
    "stream-spec": specPath,
    "observed-origin-main": originMain,
    "expect-revision": String(committed.registry.revision),
    render: renderPath,
  };

  const generatedBefore = fs.readFileSync(GENERATED);

  // The real registration operation takes the repository-wide workflow lock.
  // Retry ONLY on the typed transient LOCK_CONTENTION because a concurrent
  // planner may hold it momentarily; every other failure must fail immediately.
  let result = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    result = runTransition({ statePath: clonePath, transitionName: "create-stream", flags, now: PROBE_NOW, gitMemo: GIT_MEMO });
    if (result.status === "ok") break;
    const codes = (result.errors || []).map((error) => error.code);
    const transient = codes.length === 1 && codes[0] === "LOCK_CONTENTION";
    if (!transient || attempt === 5) break;
    const sab = new Int32Array(new SharedArrayBuffer(4));
    Atomics.wait(sab, 0, 0, 250);
  }

  const enlargedBytes = fs.readFileSync(clonePath);
  probeFixture = {
    dir,
    clonePath,
    renderPath,
    committed,
    originMain,
    createdId,
    result,
    generatedBefore,
    enlargedBytes,
    enlarged: JSON.parse(enlargedBytes.toString("utf8")),
  };
  return probeFixture;
}

function getProbeFixture() {
  return probeFixture ?? buildProbeFixture();
}

// ---------------------------------------------------------------------------
// Committed-registry contract

test("the committed seed state verifies cleanly with exit code 0", () => {
  const doc = readStateDoc();
  const result = runCli(VERIFY_CLI, ["--state", STATE], { cwd: REPO_ROOT });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.json.status, "ok");
  assert.deepEqual(result.json.errors, []);
  // Derived from the registry itself: there is deliberately no fixed count pin,
  // so a stream added through create-stream cannot make this assertion red.
  assert.equal(result.json.summary.streams.total, doc.streams.length);
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

  // Divergence control: the byte parity above is not vacuous. A single mutated
  // stream must change the deterministic render.
  const mutated = cloneDoc(readStateDoc());
  mutated.streams[0].nextAction = `${mutated.streams[0].nextAction ?? ""} [divergence probe]`;
  const diverged = renderRegister(mutated, sha256Hex(fs.readFileSync(STATE)));
  assert.notDeepEqual(Buffer.from(diverged, "utf8"), fs.readFileSync(GENERATED), "a mutated stream must change the render");
});

test("the generated register is a distinct file from the historical prose register", () => {
  assert.notEqual(path.resolve(GENERATED), path.resolve(HISTORICAL));
});

test("the registry contract version, revision, and leases derive from the shipped schema", () => {
  const doc = readStateDoc();
  const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, "utf8"));
  // Asserted against the shipped schema constant, never against a literal.
  assert.equal(doc.contractVersion, schema.properties.contractVersion.const);
  assert.equal(Number.isInteger(doc.registry.revision) && doc.registry.revision >= 1, true);
  assert.ok(Array.isArray(doc.leases), "the seed must declare the leases array");
});

test("every registered stream carries a null-or-committed candidate SHA and no legacy remoteSha", () => {
  const doc = readStateDoc();
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
  const doc = readStateDoc();
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

// ---------------------------------------------------------------------------
// §A Failing-first control and §B core baseline

test("the immutable core stream baseline is a subset of the registry and its predicate detects removal", () => {
  const doc = readStateDoc();
  assert.equal(
    coreInventoryMismatch(doc),
    null,
    `the core baseline must be a subset of the registry: ${JSON.stringify(coreInventoryMismatch(doc))}`,
  );

  // Removal control: losing a core stream is corruption, not churn.
  const control = cloneDoc(doc);
  const removed = CORE_STREAM_IDS[0];
  control.streams = control.streams.filter((s) => s.id !== removed);
  const mismatch = coreInventoryMismatch(control);
  assert.ok(mismatch, "removing a core stream must fail the subset predicate");
  assert.deepEqual(mismatch.missing, [removed]);
});

test("the retired exact-inventory predicate rejects the committed registry with an observable removal control", () => {
  const doc = readStateDoc();
  const mismatch = retiredExactInventoryMismatch(doc);
  assert.ok(mismatch, "the retired exact-equality pin must reject the committed registry (that is the defect it caused)");
  assert.ok(mismatch.extra.length > 0, "the committed registry carries streams added after the retirement commit");
  assert.deepEqual(mismatch.missing, [], "every retired inventory id must still be registered; registry rows are retained forever");

  // Removal control: retiring a row must surface as a missing member rather than
  // be absorbed silently by the predicate.
  const control = cloneDoc(doc);
  const removed = RETIRED_PINNED_INVENTORY[0];
  control.streams = control.streams.filter((s) => s.id !== removed);
  const controlMismatch = retiredExactInventoryMismatch(control);
  assert.ok(controlMismatch, "removing a retired id must keep failing the predicate");
  assert.deepEqual(controlMismatch.missing, [removed]);
});

// ---------------------------------------------------------------------------
// §C No literal enumeration of the live inventory

test("no non-core, non-retired registered stream id is enumerated as a quoted literal in this test source", () => {
  const doc = readStateDoc();
  const source = fs.readFileSync(SELF, "utf8");
  const exempt = new Set([...CORE_STREAM_IDS, ...RETIRED_PINNED_INVENTORY]);
  const checked = doc.streams.map((s) => s.id).filter((id) => !exempt.has(id));
  assert.ok(checked.length > 0, "the guard needs at least one non-core, non-retired stream to be meaningful");
  for (const id of checked) {
    assert.equal(
      source.includes(`"${id}"`),
      false,
      `stream id ${id} must not be enumerated as a quoted literal in seed.test.mjs; the contract must stay generic`,
    );
  }
});

// ---------------------------------------------------------------------------
// §D Generic per-stream invariants through the production verifier

test("every registered stream is rejected at its own path for each contract invariant family", () => {
  const pristine = readStateDoc();

  // Pristine control: the committed registry must be verifier-clean, otherwise
  // every per-stream expectation below would be measured against a dirty base.
  const clean = verifyStateDocument(STATE, { gitMemo: GIT_MEMO });
  assert.equal(clean.ok, true, JSON.stringify(clean.errors));
  assert.deepEqual(clean.errors, []);

  const failures = [];
  for (const family of FAMILIES) {
    const doc = cloneDoc(pristine);
    const expected = family.apply(doc);
    // Vacuity guard: a family that silently stops applying must fail, not pass.
    if (expected.length === 0) failures.push(`${family.name}: applicable set is empty`);

    const result = verifyStateDocument(STATE, { stateBytes: docBytes(doc), gitMemo: GIT_MEMO, now: family.now });
    for (const { code, path: errPath } of expected) {
      if (!result.errors.some((error) => error.code === code && error.path === errPath)) {
        failures.push(`${family.name}: missing ${code} at ${errPath}`);
      }
    }
  }

  assert.deepEqual(
    failures,
    [],
    `the generic invariant matrix must reject every applicable stream:\n${failures.join("\n")}`,
  );
});

// ---------------------------------------------------------------------------
// §E Failing-first regression: real create-stream on a clone
// §F Negative mutants for the newly created stream

test("a stream created through the real create-stream operation keeps verify and render green with no source edit", () => {
  const probe = getProbeFixture();

  // The fixture path must be Git-ignored so an interrupted run can never dirty
  // the candidate range.
  assert.equal(runGit(["check-ignore", "-q", path.relative(REPO_ROOT, probe.dir)], REPO_ROOT).ok, true, "the probe fixture must be Git-ignored");

  // The committed generated register must never be rewritten by the regression.
  assert.deepEqual(fs.readFileSync(GENERATED), probe.generatedBefore, "the probe must not rewrite the committed generated register");

  // (4a) the real operation succeeded and reported exactly one appended record.
  assert.equal(probe.result.status, "ok", JSON.stringify(probe.result.errors));
  assert.equal(probe.result.summary.created, true);
  assert.equal(probe.result.summary.streamId, probe.createdId);
  assert.equal(probe.result.summary.revision, probe.committed.registry.revision + 1);

  // (4b) exactly one record appended, revision advanced once.
  assert.equal(probe.enlarged.streams.length, probe.committed.streams.length + 1);
  assert.equal(probe.enlarged.registry.revision, probe.committed.registry.revision + 1);

  // (4c) every pre-existing record survives byte-identically.
  for (const prior of probe.committed.streams) {
    assert.deepEqual(
      probe.enlarged.streams.find((s) => s.id === prior.id),
      prior,
      `${prior.id} must be byte-identical after create-stream`,
    );
  }

  // (4d) the created record is well-formed and carries the observed remote tip.
  const created = probe.enlarged.streams.find((s) => s.id === probe.createdId);
  assert.ok(created, "the created stream must be present in the enlarged clone");
  assert.equal(created.state, "PLANNED");
  assert.equal(created.git.remoteObservation.ref, "refs/remotes/origin/main");
  assert.equal(created.git.remoteObservation.sha, probe.originMain);

  // (4e) the enlarged clone verifies cleanly.
  const verified = verifyStateDocument(probe.clonePath, { gitMemo: GIT_MEMO });
  assert.equal(verified.ok, true, JSON.stringify(verified.errors));
  assert.deepEqual(verified.errors, []);

  // (4f) the CLI renderer exits 0, names the created stream, and equals the
  // in-process renderer output over the same bytes.
  const cliOutput = path.join(probe.dir, "cli-render.md");
  const rendered = runCli(RENDER_CLI, ["--state", probe.clonePath, "--output", cliOutput], { cwd: REPO_ROOT });
  assert.equal(rendered.status, 0, rendered.stdout + rendered.stderr);
  const cliBytes = fs.readFileSync(cliOutput, "utf8");
  assert.equal(cliBytes, renderRegister(probe.enlarged, sha256Hex(probe.enlargedBytes)), "the CLI render must equal the in-process renderer output");
  assert.ok(cliBytes.includes(probe.createdId), "the rendered register must name the created stream");

  // (6) the retired exact-inventory predicate rejects BOTH registries: that is
  // why the old design was red, while every new-contract assertion above is
  // green with the same, unedited test source.
  assert.ok(retiredExactInventoryMismatch(probe.committed), "the retired predicate must reject the committed registry");
  assert.ok(retiredExactInventoryMismatch(probe.enlarged), "the retired predicate must reject the enlarged registry");
});

test("negative mutants on the newly created stream are rejected at the created stream's own path", () => {
  const probe = getProbeFixture();
  const createdIndex = probe.enlarged.streams.findIndex((s) => s.id === probe.createdId);
  assert.ok(createdIndex >= 0, "the created stream must be present before its mutants are exercised");

  const cases = [
    {
      name: "malformed newly created candidate SHA",
      mutate: (doc) => {
        doc.streams[createdIndex].git.candidateSha = "not-a-sha";
      },
      code: "SCHEMA_PATTERN",
      errPath: `$.streams[${createdIndex}].git.candidateSha`,
    },
    {
      name: "duplicate newly created stream id",
      mutate: (doc) => {
        doc.streams.push(cloneDoc(doc.streams[createdIndex]));
      },
      code: "DUPLICATE_STREAM_ID",
      errPath: `streams[${probe.enlarged.streams.length}].id`,
    },
    {
      name: "newly created stream missing owners",
      mutate: (doc) => {
        delete doc.streams[createdIndex].owners;
      },
      code: "SCHEMA_REQUIRED",
      errPath: `$.streams[${createdIndex}]`,
    },
    {
      name: "newly created stream missing nextAction",
      mutate: (doc) => {
        delete doc.streams[createdIndex].nextAction;
      },
      code: "SCHEMA_REQUIRED",
      errPath: `$.streams[${createdIndex}]`,
    },
  ];

  const failures = [];
  for (const testCase of cases) {
    const doc = cloneDoc(probe.enlarged);
    testCase.mutate(doc);
    const result = verifyStateDocument(probe.clonePath, { stateBytes: docBytes(doc), gitMemo: GIT_MEMO });
    if (!result.errors.some((error) => error.code === testCase.code && error.path === testCase.errPath)) {
      failures.push(
        `${testCase.name}: missing ${testCase.code} at ${testCase.errPath}; got ${JSON.stringify(result.errors.map((e) => `${e.code}@${e.path}`))}`,
      );
    }
  }

  assert.deepEqual(failures, [], `the generic contract must cover a stream that did not exist when this source was written:\n${failures.join("\n")}`);
});
