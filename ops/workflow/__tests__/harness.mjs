// ops/workflow/__tests__/harness.mjs
// Shared, hermetic test helpers. Node built-ins only. Never touches the real
// repository: every Git repository and state document is created under os.tmpdir().
//
// Performance (A6): the fixture matrix validates in-process through the same
// production engine (lib/verify.mjs) against ONE shared disposable repository
// instead of spawning a Node process and a fresh Git repository per fixture. At
// least one true CLI process test and the real Git checkout portability tests
// are preserved.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifyStateDocument } from "../lib/verify.mjs";

export const WORKFLOW_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FIXTURES_DIR = path.join(WORKFLOW_DIR, "__fixtures__");
export const VERIFY_CLI = path.join(WORKFLOW_DIR, "verify-cycle.mjs");
export const RENDER_CLI = path.join(WORKFLOW_DIR, "render-register.mjs");
export const TRANSITION_CLI = path.join(WORKFLOW_DIR, "transition.mjs");
export const CHECKPOINT_CLI = path.join(WORKFLOW_DIR, "checkpoint.mjs");
export const STATUS_CLI = path.join(WORKFLOW_DIR, "status.mjs");
export const CUSTODY_CLI = path.join(WORKFLOW_DIR, "custody.mjs");
export const PINS_CLI = path.join(WORKFLOW_DIR, "pins.mjs");
export const DEPS_CLI = path.join(WORKFLOW_DIR, "deps.mjs");
export const SCHEMA_FILE = path.join(WORKFLOW_DIR, "schema", "cycle-state.schema.json");
export const REPO_ROOT = path.resolve(WORKFLOW_DIR, "..", "..");

export function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function git(dir, args) {
  const res = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", windowsHide: true });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed (${res.status}): ${res.stderr || res.stdout}`);
  }
  return res.stdout.trim();
}

/**
 * Deterministic disposable repository built with one `git fast-import` process
 * (process creation dominates test time on this host):
 *   base commit       -> base.txt, AGENTS.md
 *   candidate commit  -> candidate.txt (child of base)
 *   integration commit-> integration.txt (child of candidate)
 *   orphan commit     -> other.txt (unrelated root, refs/heads/other, NO AGENTS.md)
 *
 * `AGENTS.md` is present on every `main` commit and materialized in the working
 * tree with identical bytes, so the production registration path's
 * directive-copy guard (WF-C10 section 3.4) sees a copy that matches the
 * observed tip. The orphan branch deliberately has no `AGENTS.md`, which is the
 * DIRECTIVE_REMOTE_UNRESOLVED control.
 */
export const AGENTS_FIXTURE_CONTENT =
  "# ATLAS directive-copy fixture (WF-C10)\nThe operating copy must match the observed tip's AGENTS.md blob.\n";

export function createTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc02-repo-"));
  git(dir, ["init", "-b", "main"]);
  const ident = "WF-C02 Fixture <wfc02@example.invalid> 1700000000 +0000";
  const agentsBytes = Buffer.byteLength(AGENTS_FIXTURE_CONTENT, "utf8");
  const stream =
    [
      "blob", "mark :1", "data <<EOM", "base", "EOM",
      "blob", "mark :9", `data ${agentsBytes}`, AGENTS_FIXTURE_CONTENT,
      "commit refs/heads/main", "mark :2", `author ${ident}`, `committer ${ident}`, "data <<EOM", "base", "EOM", "M 100644 :1 base.txt", "M 100644 :9 AGENTS.md",
      "blob", "mark :3", "data <<EOM", "candidate", "EOM",
      "commit refs/heads/main", "mark :4", `author ${ident}`, `committer ${ident}`, "data <<EOM", "candidate", "EOM", "from :2", "M 100644 :3 candidate.txt",
      "blob", "mark :5", "data <<EOM", "integration", "EOM",
      "commit refs/heads/main", "mark :6", `author ${ident}`, `committer ${ident}`, "data <<EOM", "integration", "EOM", "from :4", "M 100644 :5 integration.txt",
      "blob", "mark :7", "data <<EOM", "other", "EOM",
      "commit refs/heads/other", "mark :8", `author ${ident}`, `committer ${ident}`, "data <<EOM", "other", "EOM", "M 100644 :7 other.txt",
      "",
    ].join("\n");
  const res = spawnSync("git", ["-C", dir, "fast-import", "--quiet"], { input: stream, encoding: "utf8", windowsHide: true });
  if (res.status !== 0) {
    throw new Error(`git fast-import failed (${res.status}): ${res.stderr || res.stdout}`);
  }
  // Materialize the directive copy so the operating-copy hash matches the blob.
  fs.writeFileSync(path.join(dir, "AGENTS.md"), AGENTS_FIXTURE_CONTENT);
  const revs = git(dir, ["rev-parse", "refs/heads/main~2", "refs/heads/main~1", "refs/heads/main", "refs/heads/other"]);
  const [baseSha, candidateSha, integrationSha, otherSha] = revs.split(/\r?\n/).map((line) => line.trim());
  return { dir, baseSha, candidateSha, integrationSha, otherSha };
}

let shared = null;

// One read-only disposable repository reused across a test file's fixtures. It
// is never written to by fixture subjects, so sharing preserves proof strength.
export function getSharedRepo() {
  if (!shared) {
    shared = createTempRepo();
    const dir = shared.dir;
    process.on("exit", () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    });
  }
  return shared;
}

export function cleanupRepo(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

// A small repository with a populated, clean working tree.
export function createCleanRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc02-clean-"));
  git(dir, ["init", "-b", "main"]);
  fs.writeFileSync(path.join(dir, "tracked.txt"), "tracked\n");
  git(dir, ["add", "-A"]);
  git(dir, ["-c", "user.name=WF-C02 Fixture", "-c", "user.email=wfc02@example.invalid", "-c", "commit.gpgsign=false", "commit", "-m", "tracked"]);
  return dir;
}

export function substitute(raw, map) {
  let out = raw;
  for (const [key, value] of Object.entries(map)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

export function fixtureRaw(name) {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8");
}

export function repoSubstitutions(repo) {
  return {
    BASE_SHA: repo.baseSha,
    CANDIDATE_SHA: repo.candidateSha,
    INTEGRATION_SHA: repo.integrationSha,
    OTHER_SHA: repo.otherSha,
  };
}

export function writeState(repo, name, contents) {
  const filePath = path.join(repo.dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  return filePath;
}

// Materialize a fixture into a mutable state document with real repository SHAs.
export function stateDocFromFixture(fixtureName, repo, mutate) {
  const doc = JSON.parse(substitute(fixtureRaw(fixtureName), repoSubstitutions(repo)));
  if (mutate) mutate(doc, repo);
  return doc;
}

export function writeStateDoc(repo, name, doc) {
  return writeState(repo, name, `${JSON.stringify(doc, null, 2)}\n`);
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

export function makeReceipt({ statePathAsGiven, stateBytes, streamId, candidateSha, integrationSha, qaVerdict, auditorVerdict, gates, artifacts, readiness, receiptVersion }) {
  const receipt = {
    receiptVersion: receiptVersion || "1.0.0",
    generatedAt: "2026-09-14T02:00:00Z",
    statePath: statePathAsGiven,
    stateSha256: sha256(Buffer.from(stateBytes)),
    status: "ok",
    streamId,
    verified: {
      candidateSha: candidateSha ?? null,
      integrationSha: integrationSha ?? null,
      qaVerdict: qaVerdict ?? null,
      auditorVerdict: auditorVerdict ?? null,
      gates,
      artifacts: artifacts || [],
    },
  };
  if (readiness !== undefined) receipt.verified.readiness = readiness;
  return receipt;
}

export function writeReceipt(repo, relPath, receipt) {
  const filePath = path.join(repo.dir, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(receipt, null, 2)}\n`);
  return sha256(fs.readFileSync(filePath));
}

export function runCli(scriptPath, args, options = {}) {
  const res = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: options.cwd,
    encoding: "utf8",
    windowsHide: true,
    env: options.env || process.env,
  });
  let json = null;
  try {
    json = JSON.parse(res.stdout);
  } catch {
    json = null;
  }
  return { status: res.status, stdout: res.stdout || "", stderr: res.stderr || "", json };
}

export function errorCodes(result) {
  return (result.json && Array.isArray(result.json.errors) ? result.json.errors : []).map((e) => e.code);
}

// In-process validation through the exact production engine the CLI uses.
export function verifyInProcess(statePath, options = {}) {
  return verifyStateDocument(statePath, options);
}

export function copyWorkflowToTemp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc02-tree-"));
  fs.cpSync(WORKFLOW_DIR, path.join(dir, "workflow"), { recursive: true });
  return {
    dir,
    verifyCli: path.join(dir, "workflow", "verify-cycle.mjs"),
    renderCli: path.join(dir, "workflow", "render-register.mjs"),
    transitionCli: path.join(dir, "workflow", "transition.mjs"),
    statusCli: path.join(dir, "workflow", "status.mjs"),
    schemaFile: path.join(dir, "workflow", "schema", "cycle-state.schema.json"),
    libRender: path.join(dir, "workflow", "lib", "render.mjs"),
    libLiveness: path.join(dir, "workflow", "lib", "liveness.mjs"),
    libReadiness: path.join(dir, "workflow", "lib", "readiness.mjs"),
  };
}
