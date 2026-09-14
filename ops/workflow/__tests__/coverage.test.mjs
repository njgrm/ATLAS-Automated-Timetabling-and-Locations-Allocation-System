// Reachability coverage for the verifier's rule codes (closes WF-C01 residual R2).
//
// Every case mutates one valid state document (or its schema) and asserts the
// intended code is reported. Cases that require a Git failure or a schema
// keyword the shipped contract never uses are retained explicitly in the README
// rather than faked here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSharedRepo, stateDocFromFixture, verifyInProcess, SCHEMA_FILE } from "./harness.mjs";

const ISO = "2026-09-14T10:00:00+08:00";

function completeReview() {
  return { qaVerdict: "ACCEPT_READY", qaSessionId: "ses-qa", auditorVerdict: "AUDIT_CLEAR", auditorSessionId: "ses-aud", auditRequired: true };
}

function runCase({ fixture = "pass-ordinary.json", mutate, schemaPatch, inRepo = true }) {
  const repo = getSharedRepo();
  const doc = stateDocFromFixture(fixture, repo, mutate);
  let options = {};
  if (schemaPatch) {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, "utf8"));
    schemaPatch(schema);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc02-schema-"));
    const schemaPath = path.join(dir, "schema.json");
    fs.writeFileSync(schemaPath, JSON.stringify(schema));
    options = { schemaPath };
  }
  const stateDir = inRepo ? repo.dir : fs.mkdtempSync(path.join(os.tmpdir(), "wfc02-outside-"));
  const statePath = path.join(stateDir, `coverage-${process.pid}-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(statePath, `${JSON.stringify(doc, null, 2)}\n`);
  const result = verifyInProcess(statePath, options);
  return result.errors.map((e) => e.code);
}

const CASES = [
  {
    code: "DUPLICATE_STREAM_ID",
    mutate: (d) => {
      d.streams.push(JSON.parse(JSON.stringify(d.streams[0])));
    },
  },
  {
    code: "CORRECTIONS_INVALID",
    mutate: (d, repo) => {
      d.streams[0].corrections = [
        { round: 1, baseSha: repo.baseSha, candidateSha: repo.candidateSha, reason: "r1", qaVerdict: null, qaSessionId: null, auditorVerdict: null, auditorSessionId: null },
        { round: 1, baseSha: repo.baseSha, candidateSha: repo.otherSha, reason: "r2", qaVerdict: null, qaSessionId: null, auditorVerdict: null, auditorSessionId: null },
      ];
    },
  },
  {
    code: "COMPLETE_MISSING_QA",
    mutate: (d) => {
      d.streams[0].state = "COMPLETE";
      d.streams[0].nextAction = null;
    },
  },
  {
    code: "COMPLETE_MISSING_AUDIT",
    mutate: (d) => {
      d.streams[0].state = "COMPLETE";
      d.streams[0].nextAction = null;
      d.streams[0].review = { qaVerdict: "ACCEPT_READY", qaSessionId: "q", auditorVerdict: null, auditorSessionId: null, auditRequired: true };
    },
  },
  {
    code: "POST_CORRECTION_FRESH_AUDIT_MISSING",
    mutate: (d, repo) => {
      d.streams[0].state = "COMPLETE";
      d.streams[0].nextAction = null;
      d.streams[0].review = completeReview();
      d.streams[0].corrections = [
        { round: 1, baseSha: repo.baseSha, candidateSha: repo.candidateSha, reason: "r1", qaVerdict: "ACCEPT_READY", qaSessionId: "q1", auditorVerdict: null, auditorSessionId: null },
      ];
    },
  },
  {
    code: "HIGH_APPROVAL_INCOMPLETE",
    mutate: (d) => {
      d.streams[0].approval = { required: true, presentedReady: false, granted: true, operatorIdentity: null, approvedAt: null, boundary: null, approvedActions: [], requiredObservationIds: [], execution: null };
    },
  },
  {
    code: "HIGH_DEPENDENCY_MISSING",
    mutate: (d) => {
      d.streams[0].approval = { required: true, presentedReady: true, granted: false, operatorIdentity: null, approvedAt: null, boundary: null, approvedActions: [], requiredObservationIds: ["obs-missing"], execution: null };
    },
  },
  {
    code: "ARTIFACT_MISSING",
    mutate: (d) => {
      d.streams[0].artifacts = [{ path: "ops/workflow/does-not-exist.txt", sha256: "a".repeat(64) }];
    },
  },
  {
    code: "ARTIFACT_HASH_MISMATCH",
    mutate: (d, repo) => {
      fs.writeFileSync(path.join(repo.dir, "coverage-artifact.txt"), "artifact body\n");
      d.streams[0].artifacts = [{ path: "coverage-artifact.txt", sha256: "b".repeat(64) }];
    },
  },
  {
    code: "BLOCKER_KIND_MISMATCH",
    mutate: (d) => {
      d.streams[0].state = "EXTERNALLY_BLOCKED";
      d.streams[0].blocker = { kind: "NONE", detail: "", safeWorkRemaining: false, safeWorkItems: [] };
    },
  },
  {
    code: "BLOCKER_INCONSISTENT",
    mutate: (d) => {
      d.streams[0].blocker = { kind: "NONE", detail: "", safeWorkRemaining: true, safeWorkItems: [] };
    },
  },
  {
    code: "GIT_REPO_UNAVAILABLE",
    inRepo: false,
    mutate: (d, repo) => {
      d.streams[0].git.baseSha = repo.baseSha;
      d.streams[0].git.candidateSha = repo.candidateSha;
      d.streams[0].git.changedPaths = ["candidate.txt"];
    },
  },
  {
    code: "ACTIVE_CYCLE_UNKNOWN",
    mutate: (d) => {
      d.coordination = { mode: "CYCLE_ACTIVE", activeCycleId: "NOPE", globalNextAction: "continue" };
    },
  },
  {
    code: "ACTIVE_CYCLE_TERMINAL",
    mutate: (d) => {
      const closed = JSON.parse(JSON.stringify(d.streams[0]));
      closed.id = "CLOSED-1";
      closed.state = "CLOSED";
      closed.nextAction = null;
      closed.running = [];
      closed.awaited = [];
      d.streams.push(closed);
      d.coordination = { mode: "CYCLE_ACTIVE", activeCycleId: "CLOSED-1", globalNextAction: "continue" };
    },
  },
  {
    code: "COORDINATION_MODE_CONFLICT",
    mutate: (d) => {
      d.coordination = { mode: "MANUAL", activeCycleId: "ORD-1", globalNextAction: null };
    },
  },
  {
    code: "COORDINATION_NEXT_ACTION_MISSING",
    mutate: (d) => {
      d.coordination = { mode: "CYCLE_ACTIVE", activeCycleId: "ORD-1", globalNextAction: null };
    },
  },
  {
    code: "AWAITED_STATE_MISSING",
    mutate: (d) => {
      d.streams[0].running = [];
      d.streams[0].awaited = [];
      d.coordination = { mode: "CYCLE_ACTIVE", activeCycleId: "ORD-1", globalNextAction: "continue" };
    },
  },
  {
    code: "LOGIN_PROFILE_UNKNOWN",
    mutate: (d) => {
      d.browserCustody = {
        profiles: [],
        logins: [{ id: "login-1", owner: "qa", profilePath: "C:/unknown/profile", performed: false, performedAt: null, authorization: null, evidence: null }],
      };
    },
  },
  // ---- Schema-level codes ---------------------------------------------------
  {
    code: "SCHEMA_TYPE",
    mutate: (d) => {
      d.registry.lastUpdatedBy = 42;
    },
  },
  {
    code: "SCHEMA_ENUM",
    mutate: (d) => {
      d.streams[0].riskTier = "EXTREME";
    },
  },
  {
    code: "SCHEMA_CONST",
    mutate: (d) => {
      d.contractVersion = "9.9.9";
    },
  },
  {
    code: "SCHEMA_MINIMUM",
    mutate: (d) => {
      d.registry.revision = 0;
    },
  },
  {
    code: "SCHEMA_MIN_LENGTH",
    mutate: (d) => {
      d.streams[0].id = "";
    },
  },
  {
    code: "SCHEMA_FALSE_SCHEMA",
    schemaPatch: (schema) => {
      schema.properties.contractVersion = false;
    },
    mutate: () => {},
  },
  {
    code: "SCHEMA_INVALID",
    schemaPatch: (schema) => {
      schema.properties.contractVersion = 5;
    },
    mutate: () => {},
  },
  {
    code: "SCHEMA_REF",
    schemaPatch: (schema) => {
      schema.properties.contractVersion = { $ref: "#/$defs/does-not-exist" };
    },
    mutate: () => {},
  },
  {
    code: "SCHEMA_PATTERN_INVALID",
    schemaPatch: (schema) => {
      schema.properties.registry.properties.lastUpdatedBy = { type: "string", pattern: "([" };
    },
    mutate: () => {},
  },
];

for (const testCase of CASES) {
  test(`verifier code ${testCase.code} is reachable`, () => {
    const codes = runCase(testCase);
    assert.ok(codes.includes(testCase.code), `expected ${testCase.code}, got ${JSON.stringify(codes)}`);
  });
}
