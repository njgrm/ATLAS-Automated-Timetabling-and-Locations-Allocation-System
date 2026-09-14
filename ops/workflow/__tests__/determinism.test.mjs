import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  VERIFY_CLI,
  RENDER_CLI,
  SCHEMA_FILE,
  createTempRepo,
  cleanupRepo,
  fixtureRaw,
  repoSubstitutions,
  substitute,
  writeState,
  runCli,
  copyWorkflowToTemp,
} from "./harness.mjs";

function ordinaryState(repo, name = "state.json") {
  return writeState(repo, name, substitute(fixtureRaw("pass-ordinary.json"), repoSubstitutions(repo)));
}

test("verify stdout is byte-identical across two runs on identical input", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = ordinaryState(repo);

  const first = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  const second = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(first.status, 0);
  assert.equal(second.status, 0);
  assert.equal(first.stdout, second.stdout);
});

test("render output is byte-identical across two runs", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = ordinaryState(repo);
  const outA = path.join(repo.dir, "out-a.md");
  const outB = path.join(repo.dir, "out-b.md");

  const first = runCli(RENDER_CLI, ["--state", statePath, "--output", outA], { cwd: repo.dir });
  const second = runCli(RENDER_CLI, ["--state", statePath, "--output", outB], { cwd: repo.dir });
  assert.equal(first.status, 0, first.stdout);
  assert.equal(second.status, 0, second.stdout);
  assert.equal(first.stdout, second.stdout);
  assert.deepEqual(fs.readFileSync(outA), fs.readFileSync(outB));
});

test("render output is independent of the state file path", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const shared = substitute(fixtureRaw("pass-ordinary.json"), repoSubstitutions(repo));
  const firstState = writeState(repo, "path-one.json", shared);
  const secondState = writeState(repo, "nested-path-two.json", shared);
  const outA = path.join(repo.dir, "render-one.md");
  const outB = path.join(repo.dir, "render-two.md");

  const first = runCli(RENDER_CLI, ["--state", firstState, "--output", outA], { cwd: repo.dir });
  const second = runCli(RENDER_CLI, ["--state", secondState, "--output", outB], { cwd: repo.dir });
  assert.equal(first.status, 0, first.stdout);
  assert.equal(second.status, 0, second.stdout);
  assert.deepEqual(fs.readFileSync(outA), fs.readFileSync(outB));
});

test("the committed renderer contains the load-bearing determinism notice marker", () => {
  const source = fs.readFileSync(path.join(path.dirname(SCHEMA_FILE), "..", "lib", "render.mjs"), "utf8");
  assert.ok(
    source.includes('const GENERATED_NOTICE = "<!-- atlas-workflow-register: generated; do not edit -->";'),
    "renderer must keep the marker the mutant control replaces",
  );
});

test("a nondeterministic renderer mutant is detected by the determinism assertion", (t) => {
  const tree = copyWorkflowToTemp();
  t.after(() => fs.rmSync(tree.dir, { recursive: true, force: true }));

  const marker = 'const GENERATED_NOTICE = "<!-- atlas-workflow-register: generated; do not edit -->";';
  const mutant = "const GENERATED_NOTICE = `<!-- nondet ${Date.now()} -->`;";
  const source = fs.readFileSync(tree.libRender, "utf8");
  assert.ok(source.includes(marker), "mutant anchor must exist");
  fs.writeFileSync(tree.libRender, source.replace(marker, mutant));

  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = ordinaryState(repo);
  const outA = path.join(repo.dir, "mutant-a.md");
  const outB = path.join(repo.dir, "mutant-b.md");

  const first = runCli(tree.renderCli, ["--state", statePath, "--output", outA], { cwd: repo.dir });
  const second = runCli(tree.renderCli, ["--state", statePath, "--output", outB], { cwd: repo.dir });
  assert.equal(first.status, 0, first.stdout);
  assert.equal(second.status, 0, second.stdout);
  assert.notDeepEqual(
    fs.readFileSync(outA),
    fs.readFileSync(outB),
    "the mutant must produce different bytes so the determinism assertion is load-bearing",
  );
});
