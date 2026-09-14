// ops/workflow/__tests__/artifact-portability.test.mjs
// Load-bearing portability control for raw SHA-256 artifact pins.
//
// The pins carried by docs/plans/atlas-delivery-cycles.json are raw LF byte
// hashes. On hosts with core.autocrlf=true a Git checkout rewrites LF to CRLF
// unless the path is covered by an `eol=lf` attribute, which silently breaks
// every pin (and the future closure receipt pin). This test materializes the
// real pinned artifacts through a real Git checkout in a disposable repository
// and proves the LF policy is what keeps the pins valid.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { REPO_ROOT } from "./harness.mjs";

const SEED = path.join(REPO_ROOT, "docs", "plans", "atlas-delivery-cycles.json");
const ATTRIBUTES = path.join(REPO_ROOT, ".gitattributes");
const GIT_IDENTITY = ["-c", "user.name=WF-C01 Portability", "-c", "user.email=wfc01@example.invalid", "-c", "commit.gpgsign=false"];

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function git(dir, args) {
  const res = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", windowsHide: true });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed (${res.status}): ${res.stderr || res.stdout}`);
  }
  return res.stdout.trim();
}

function pinnedArtifacts() {
  const doc = JSON.parse(fs.readFileSync(SEED, "utf8"));
  const entries = [];
  for (const stream of doc.streams) {
    for (const artifact of stream.artifacts) {
      entries.push({ streamId: stream.id, path: artifact.path, sha256: artifact.sha256 });
    }
  }
  assert.ok(entries.length > 0, "the seed must pin at least one artifact");
  return entries;
}

// Parse `eol=lf` prefixes out of a .gitattributes body (e.g. `ops/workflow/**` -> `ops/workflow/`).
function lfEnforcedPrefixes(attributesBody) {
  const prefixes = [];
  for (const rawLine of attributesBody.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const tokens = line.split(/\s+/);
    if (!tokens.includes("eol=lf")) continue;
    const pattern = tokens[0];
    if (pattern.endsWith("/**")) prefixes.push(pattern.slice(0, -3));
    else if (pattern.endsWith("*")) prefixes.push(pattern.slice(0, -1));
    else prefixes.push(pattern);
  }
  return prefixes;
}

function workspaceBytes(repoRelativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, ...repoRelativePath.split("/")));
}

/**
 * Build a disposable repository containing the pinned artifacts (raw workspace
 * bytes), optionally with the workspace .gitattributes, commit, delete the
 * working copies, then materialize them through `git checkout`.
 */
function materializeThroughCheckout(artifacts, { withAttributes }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc01-portability-"));
  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "core.autocrlf", "true"]);

  if (withAttributes) {
    fs.writeFileSync(path.join(dir, ".gitattributes"), fs.readFileSync(ATTRIBUTES));
  }
  for (const artifact of artifacts) {
    const dest = path.join(dir, ...artifact.path.split("/"));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, workspaceBytes(artifact.path));
  }
  git(dir, ["add", "-A"]);
  git(dir, [...GIT_IDENTITY, "commit", "-m", "materialize pinned artifacts"]);

  for (const artifact of artifacts) {
    fs.rmSync(path.join(dir, ...artifact.path.split("/")), { force: true });
  }
  git(dir, ["checkout", "--", "."]);

  const hashes = new Map();
  for (const artifact of artifacts) {
    hashes.set(artifact.path, sha256(fs.readFileSync(path.join(dir, ...artifact.path.split("/")))));
  }
  return { dir, hashes };
}

test("every seed-pinned artifact path is covered by an eol=lf attribute", () => {
  assert.ok(fs.existsSync(ATTRIBUTES), "the repository root .gitattributes must exist");
  const prefixes = lfEnforcedPrefixes(fs.readFileSync(ATTRIBUTES, "utf8"));
  assert.ok(prefixes.length > 0, "at least one eol=lf policy must be declared");
  for (const artifact of pinnedArtifacts()) {
    assert.ok(
      prefixes.some((prefix) => artifact.path.startsWith(prefix)),
      `pinned artifact ${artifact.path} is not covered by any eol=lf prefix (${prefixes.join(", ")}) — extend .gitattributes`,
    );
  }
});

test("pinned artifacts materialize with their raw LF pins through a Git checkout", (t) => {
  const artifacts = pinnedArtifacts();
  const repo = materializeThroughCheckout(artifacts, { withAttributes: true });
  t.after(() => fs.rmSync(repo.dir, { recursive: true, force: true }));

  for (const artifact of artifacts) {
    assert.equal(
      repo.hashes.get(artifact.path),
      artifact.sha256,
      `${artifact.path} changed bytes under a Git checkout; the LF policy is not holding`,
    );
  }
});

test("mutant: without the .gitattributes rules the materialized bytes differ from their pins", (t) => {
  const artifacts = pinnedArtifacts();
  const repo = materializeThroughCheckout(artifacts, { withAttributes: false });
  t.after(() => fs.rmSync(repo.dir, { recursive: true, force: true }));

  const mismatched = artifacts.filter((artifact) => repo.hashes.get(artifact.path) !== artifact.sha256);
  assert.ok(
    mismatched.length > 0,
    "the mutant control could not reproduce the CRLF defect; the portability test would not be load-bearing",
  );
});
