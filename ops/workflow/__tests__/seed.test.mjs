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
  assert.equal(result.json.summary.streams.total, 5);
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

test("the seed declares the five expected streams and keeps candidateSha null", () => {
  const doc = JSON.parse(fs.readFileSync(STATE, "utf8"));
  assert.deepEqual(
    doc.streams.map((s) => s.id).sort(),
    ["ENROLLPRO-PROXY-RECOVERY-LIVE", "LIVE-GENERATION", "LIVE-PUBLICATION", "TT-SOURCE-FRESHNESS-C04", "WF-C01"],
  );
  for (const stream of doc.streams) {
    if (stream.id === "ENROLLPRO-PROXY-RECOVERY-LIVE") {
      assert.equal(stream.git.candidateSha, "54dce67b8392cbce09aa810813c37f9c87a67159");
    } else {
      assert.equal(stream.git.candidateSha, null);
    }
  }
});

test("the generated register is a distinct file from the historical prose register", () => {
  assert.notEqual(path.resolve(GENERATED), path.resolve(HISTORICAL));
});
