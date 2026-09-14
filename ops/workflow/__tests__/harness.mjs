// ops/workflow/__tests__/harness.mjs
// Shared, hermetic test helpers. Node built-ins only. Never touches the real
// repository: every Git repository and state document is created under os.tmpdir().
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const WORKFLOW_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FIXTURES_DIR = path.join(WORKFLOW_DIR, "__fixtures__");
export const VERIFY_CLI = path.join(WORKFLOW_DIR, "verify-cycle.mjs");
export const RENDER_CLI = path.join(WORKFLOW_DIR, "render-register.mjs");
export const SCHEMA_FILE = path.join(WORKFLOW_DIR, "schema", "cycle-state.schema.json");
export const REPO_ROOT = path.resolve(WORKFLOW_DIR, "..", "..");

const GIT_IDENTITY = ["-c", "user.name=WF-C01 Fixture", "-c", "user.email=wfc01@example.invalid", "-c", "commit.gpgsign=false"];

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
 * Deterministic disposable repository:
 *   base commit       -> base.txt
 *   candidate commit  -> candidate.txt
 *   integration commit-> integration.txt
 *   orphan commit     -> other.txt (unrelated root)
 */
export function createTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc01-repo-"));
  git(dir, ["init", "-b", "main"]);
  const commit = (file, contents, message) => {
    fs.writeFileSync(path.join(dir, file), contents);
    git(dir, ["add", file]);
    git(dir, [...GIT_IDENTITY, "commit", "-m", message]);
    return git(dir, ["rev-parse", "HEAD"]);
  };
  const baseSha = commit("base.txt", "base\n", "base");
  const candidateSha = commit("candidate.txt", "candidate\n", "candidate");
  const integrationSha = commit("integration.txt", "integration\n", "integration");
  git(dir, ["checkout", "--orphan", "other"]);
  fs.writeFileSync(path.join(dir, "other.txt"), "other\n");
  git(dir, ["add", "other.txt"]);
  git(dir, [...GIT_IDENTITY, "commit", "-m", "other"]);
  const otherSha = git(dir, ["rev-parse", "HEAD"]);
  git(dir, ["checkout", "main"]);
  return { dir, baseSha, candidateSha, integrationSha, otherSha };
}

export function cleanupRepo(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
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
  fs.writeFileSync(filePath, contents);
  return filePath;
}

export function makeReceipt({ statePathAsGiven, stateBytes, streamId, candidateSha, integrationSha, qaVerdict, auditorVerdict, gates, artifacts }) {
  return {
    receiptVersion: "1.0.0",
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

export function copyWorkflowToTemp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc01-tree-"));
  fs.cpSync(WORKFLOW_DIR, path.join(dir, "workflow"), { recursive: true });
  return {
    dir,
    verifyCli: path.join(dir, "workflow", "verify-cycle.mjs"),
    renderCli: path.join(dir, "workflow", "render-register.mjs"),
    schemaFile: path.join(dir, "workflow", "schema", "cycle-state.schema.json"),
    libRender: path.join(dir, "workflow", "lib", "render.mjs"),
  };
}
