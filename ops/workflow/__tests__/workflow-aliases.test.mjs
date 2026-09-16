// WF-C10 section 3.11 (rows 37-39) - the documented `workflow:*` npm aliases.
//
// A mandatory gate whose documented command cannot be invoked is a truth defect:
// an operator or auditor following the README gets exit 2 and the temptation is
// to substitute a hand-typed invocation nobody re-verifies. These rows invoke
// every published alias in a clean disposable checkout and record its exit code,
// then prove the repair is minimal and still fail-closed from a wrong working
// directory.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { REPO_ROOT, VERIFY_CLI, createTempRepo, cleanupRepo, runCli, stateDocFromFixture, writeState } from "./harness.mjs";

const WORKFLOW_SCRIPTS = [
  "workflow:test",
  "workflow:verify",
  "workflow:render",
  "workflow:render:check",
  "workflow:transition",
  "workflow:checkpoint",
  "workflow:status",
  "workflow:custody",
];

function readScripts() {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).scripts;
}

function runNpm(cwd, args) {
  return spawnSync("npm", args, { cwd, encoding: "utf8", windowsHide: true, shell: true });
}

/** A clean disposable checkout carrying the real aliases and workflow tree. */
function makeAliasCheckout() {
  const repo = createTempRepo();
  fs.cpSync(path.join(REPO_ROOT, "ops", "workflow"), path.join(repo.dir, "ops", "workflow"), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, "package.json"), path.join(repo.dir, "package.json"));
  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.leases = [];
    d.streams[0].state = "REVIEW_REQUIRED";
    d.streams[0].running = [];
  });
  writeState(repo, "docs/plans/atlas-delivery-cycles.json", `${JSON.stringify(doc, null, 2)}\n`);
  return repo;
}

test("row 37: every documented workflow:* alias runs as published in a clean checkout", (t) => {
  const repo = makeAliasCheckout();
  t.after(() => cleanupRepo(repo.dir));

  // The disposable checkout's own register must be verifier-clean first, so the
  // exit codes below attest the aliases rather than a pre-existing state defect.
  const precondition = runCli(VERIFY_CLI, ["--state", path.join(repo.dir, "docs", "plans", "atlas-delivery-cycles.json")], { cwd: repo.dir });
  assert.equal(precondition.status, 0, precondition.stdout + precondition.stderr);

  // `workflow:test` is the gate itself and is deliberately NOT invoked here: its
  // documented form is the suite glob, and a suite invoking the suite would
  // recurse. The six self-contained aliases are the section 3.11 surface.
  const invocations = [
    { name: "workflow:verify", extra: [], expected: 0 },
    { name: "workflow:render", extra: [], expected: 0 },
    { name: "workflow:render:check", extra: [], expected: 0 },
    { name: "workflow:status", extra: [], expected: 0 },
    { name: "workflow:custody", extra: [], expected: 0 },
    { name: "workflow:checkpoint", extra: ["--stream", "ORD-1"], expected: 0, note: "documented --stream pass-through" },
  ];

  for (const invocation of invocations) {
    const args = ["run", invocation.name, "--silent"];
    if (invocation.extra.length > 0) args.push("--", ...invocation.extra);
    const result = runNpm(repo.dir, args);
    assert.equal(
      result.status,
      invocation.expected,
      `${invocation.name} exited ${result.status}${invocation.note ? ` (${invocation.note})` : ""}: ${(result.stdout || "").slice(-600)}${(result.stderr || "").slice(-600)}`,
    );
  }

  // `workflow:checkpoint` is the one intentionally parameterized alias: its
  // required --stream is a pass-through, and omitting it fails closed rather
  // than silently defaulting to some other stream.
  const bareCheckpoint = runNpm(repo.dir, ["run", "workflow:checkpoint", "--silent"]);
  assert.equal(bareCheckpoint.status, 2);
  assert.match(bareCheckpoint.stdout, /USAGE_MISSING_STREAM/);

  // The published `render` alias writes the deterministic register, and
  // `render:check` then agrees byte-for-byte.
  assert.ok(fs.existsSync(path.join(repo.dir, "docs", "plans", "atlas-active-delivery-streams.generated.md")));
});

test("rows 38 and 39: the alias repair embeds the state/op explicitly and still fails closed", () => {
  const scripts = readScripts();

  // The alias inventory is exactly the documented set and nothing else was added.
  assert.deepEqual(Object.keys(scripts).filter((key) => key.startsWith("workflow:")).sort(), [...WORKFLOW_SCRIPTS].sort());

  // The four repaired aliases name their state (or op) explicitly, matching the
  // two aliases that already worked. This is the regression guard: a future edit
  // that drops the argument makes these assertions fail.
  assert.match(scripts["workflow:verify"], /--state docs\/plans\/atlas-delivery-cycles\.json/);
  assert.match(scripts["workflow:render"], /--state docs\/plans\/atlas-delivery-cycles\.json/);
  assert.match(scripts["workflow:render"], /--output docs\/plans\/atlas-active-delivery-streams\.generated\.md/);
  assert.match(scripts["workflow:checkpoint"], /--state docs\/plans\/atlas-delivery-cycles\.json/);
  assert.match(scripts["workflow:custody"], /--op status/);
  assert.match(scripts["workflow:custody"], /--state docs\/plans\/atlas-delivery-cycles\.json/);

  // `transition` remains a pure pass-through: it needs a transition name and a
  // revision that only the caller knows.
  assert.equal(scripts["workflow:transition"], "node ops/workflow/transition.mjs");

  // Minimal and fail-closed: the CLIs still have no default state path, so the
  // same alias invoked from a directory that is not the repository root fails
  // closed instead of silently operating on some other file.
  const elsewhere = fs.mkdtempSync(path.join(REPO_ROOT, "..", "wfc10-alias-cwd-"));
  try {
    const result = spawnSync("node", [path.join(REPO_ROOT, "ops", "workflow", "verify-cycle.mjs"), "--state", "docs/plans/atlas-delivery-cycles.json"], {
      cwd: elsewhere,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.notEqual(result.status, 0, "a wrong-working-directory invocation must not succeed");
    assert.match(`${result.stdout}${result.stderr}`, /STATE_UNREADABLE|STATE_PARSE_FAILED/);
  } finally {
    fs.rmSync(elsewhere, { recursive: true, force: true });
  }
});
