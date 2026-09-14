// A4 — OpenCode role definitions and the least-privilege permission matrix.
//
// Resolution is proven through the installed OpenCode configuration surface
// (`opencode debug config --pure`), and the last-matching-rule semantics are
// evaluated with the same "last matching pattern wins" order the resolver emits.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { REPO_ROOT } from "./harness.mjs";

const ROLES = ["atlas-planner", "atlas-executor", "atlas-qa", "atlas-wave-auditor"];

function resolvedConfig() {
  const result = spawnSync("opencode", ["debug", "config", "--pure"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    windowsHide: true,
    shell: true,
    timeout: 120000,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`opencode debug config --pure failed (${result.status}): ${(result.stderr || "").slice(0, 400)}`);
  }
  return JSON.parse(result.stdout);
}

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

// OpenCode resolves permissions by last matching rule; a scalar applies to all.
function resolveAction(permission, kind, value) {
  const entry = permission ? permission[kind] : undefined;
  if (entry === undefined || entry === null) return null;
  if (typeof entry === "string") return entry;
  let action = null;
  for (const [pattern, act] of Object.entries(entry)) {
    if (globToRegExp(pattern).test(value)) action = act;
  }
  return action;
}

const config = resolvedConfig();
const agents = config.agent || {};

test("project role definitions resolve from the installed OpenCode surface", () => {
  for (const name of ROLES) {
    assert.ok(agents[name], `${name} must resolve from the installed configuration`);
    assert.equal(agents[name].model, "opencode-go/deepseek-v4.1-flash", `${name} model`);
  }
  assert.equal(agents["atlas-planner"].mode, "primary");
  assert.equal(agents["atlas-planner"].variant, "max");
  for (const name of ["atlas-executor", "atlas-qa", "atlas-wave-auditor"]) {
    assert.equal(agents[name].mode, "subagent", `${name} must be a subagent`);
    assert.equal(agents[name].variant, "high", `${name} reviewer/executor tier`);
  }
});

test("the existing delegate faces are preserved", () => {
  for (const name of ["atlas-executor-delegate", "atlas-qa-delegate"]) {
    assert.ok(agents[name], `${name} must still resolve`);
    assert.equal(agents[name].mode, "subagent");
  }
});

test("the planner may invoke only the named ATLAS roles", () => {
  const permission = agents["atlas-planner"].permission;
  for (const target of ["atlas-executor", "atlas-qa", "atlas-wave-auditor", "atlas-executor-delegate", "atlas-qa-delegate"]) {
    assert.equal(resolveAction(permission, "task", target), "allow", `planner must be able to invoke ${target}`);
  }
  assert.equal(resolveAction(permission, "task", "atlas-planner"), "deny");
  assert.equal(resolveAction(permission, "task", "some-arbitrary-subagent"), "deny");
});

test("the executor is bounded to ATLAS worktrees and cannot merge, push, or delegate", () => {
  const permission = agents["atlas-executor"].permission;
  assert.equal(resolveAction(permission, "edit", "E:/ATLAS-worktrees/workflow-hardening-c02/src/a.ts"), "allow");
  assert.equal(resolveAction(permission, "edit", "D:/ATLAS/atlas-server/src/a.ts"), "allow");
  assert.equal(resolveAction(permission, "edit", "D:/EnrollPro/server/a.ts"), "deny");
  assert.equal(resolveAction(permission, "edit", "D:/AIMS/app/a.ts"), "deny");
  assert.equal(resolveAction(permission, "edit", "D:/ATLAS-runtime-config/atlas-server.env"), "deny");
  assert.equal(resolveAction(permission, "bash", "git push origin main"), "deny");
  assert.equal(resolveAction(permission, "bash", "git merge --no-ff other"), "deny");
  assert.equal(resolveAction(permission, "bash", "git commit -m bounded"), "allow");
  // Fail-closed task allowlist: an executor cannot self-promote.
  assert.equal(resolveAction(permission, "task", "atlas-planner"), "deny");
  assert.equal(resolveAction(permission, "task", "atlas-wave-auditor"), "deny");
});

test("QA and auditor are read-only and cannot delegate", () => {
  for (const name of ["atlas-qa", "atlas-wave-auditor"]) {
    const permission = agents[name].permission;
    assert.equal(resolveAction(permission, "edit", "E:/ATLAS-worktrees/workflow-hardening-c02/src/a.ts"), "deny", `${name} edit`);
    assert.equal(resolveAction(permission, "edit", "D:/ATLAS/anything.ts"), "deny", `${name} edit`);
    assert.equal(resolveAction(permission, "task", "atlas-executor"), "deny", `${name} task`);
    assert.equal(resolveAction(permission, "bash", "git push origin main"), "deny", `${name} push`);
    assert.equal(resolveAction(permission, "bash", "npm run workflow:test"), "allow", `${name} verification commands`);
  }
});

test("compaction and pruning keys are accepted by the installed version", () => {
  assert.equal(config.compaction.auto, true);
  assert.equal(config.compaction.prune, true);
  assert.equal(Object.prototype.hasOwnProperty.call(config.compaction, "reserved"), true);
  assert.equal(config.subagent_depth, 1);
  assert.equal(config.agent.compaction.variant, "low");
});
