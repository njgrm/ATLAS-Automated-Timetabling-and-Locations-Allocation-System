import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { VERIFY_CLI, RENDER_CLI, REPO_ROOT, runCli } from "./harness.mjs";

const STATE = path.join(REPO_ROOT, "docs", "plans", "atlas-delivery-cycles.json");
const GENERATED = path.join(REPO_ROOT, "docs", "plans", "atlas-active-delivery-streams.generated.md");
const HISTORICAL = path.join(REPO_ROOT, "docs", "plans", "atlas-active-delivery-streams.md");

test("the committed seed state verifies cleanly with exit code 0", () => {
  const result = runCli(VERIFY_CLI, ["--state", STATE], { cwd: REPO_ROOT });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.json.status, "ok");
  assert.deepEqual(result.json.errors, []);
  assert.equal(result.json.summary.streams.total, 6);
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

test("the seed declares the six expected streams with null-or-committed candidate SHAs", () => {
  const doc = JSON.parse(fs.readFileSync(STATE, "utf8"));
  assert.equal(doc.contractVersion, "1.1.0");
  assert.equal(Number.isInteger(doc.registry.revision) && doc.registry.revision >= 1, true);
  assert.ok(Array.isArray(doc.leases), "the seed must declare the leases array");
  assert.deepEqual(
    doc.streams.map((s) => s.id).sort(),
    ["ENROLLPRO-PROXY-RECOVERY-LIVE", "LIVE-GENERATION", "LIVE-PUBLICATION", "TT-SOURCE-FRESHNESS-C04", "WF-C01", "WF-C02"],
  );
  for (const stream of doc.streams) {
    assert.equal(Object.prototype.hasOwnProperty.call(stream.git, "remoteSha"), false, `${stream.id} must not carry the legacy remoteSha`);
    assert.equal(Object.prototype.hasOwnProperty.call(stream.git, "remoteObservation"), true, `${stream.id} must carry remoteObservation`);
    if (stream.id === "ENROLLPRO-PROXY-RECOVERY-LIVE") {
      assert.equal(stream.git.candidateSha, "54dce67b8392cbce09aa810813c37f9c87a67159");
      continue;
    }
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
    "",
    123,
  ]) {
    assert.equal(isNullOrCommittedSha(malformed), false, `predicate must reject ${JSON.stringify(malformed)}`);
  }
  assert.equal(isNullOrCommittedSha(null), true);
  assert.equal(isNullOrCommittedSha("bcee9d0d92f43a55db4cbfa3a0a6306dd57d3275"), true);
});

test("the generated register is a distinct file from the historical prose register", () => {
  assert.notEqual(path.resolve(GENERATED), path.resolve(HISTORICAL));
});
