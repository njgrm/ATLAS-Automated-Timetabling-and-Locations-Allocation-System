// WF-C10 section 3.5 (rows 16-20) and sections 3.4/3.6 - packet-pin lint,
// directive-copy fail-closed, and LF-normalized dependency identity.
//
// The pin lint is exercised through the real `pins.mjs` CLI against disposable
// Git repositories that carry a real two-step `AGENTS.md` history, so the A4
// requirement (a historical but reproducible pin survives a later directive
// bump) is proven on the production entry point rather than by a helper.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  REPO_ROOT,
  PINS_CLI,
  DEPS_CLI,
  TRANSITION_CLI,
  VERIFY_CLI,
  createCleanRepo,
  createTempRepo,
  cleanupRepo,
  git,
  runCli,
  stateDocFromFixture,
  writeStateDoc,
} from "./harness.mjs";
import { lfSha256 } from "../lib/util.mjs";
import { lintDirectivePins, gitPinResolvers } from "../lib/directive.mjs";

const GIT_IDENTITY = ["-c", "user.name=WF-C10 Pins", "-c", "user.email=wfc10@example.invalid", "-c", "commit.gpgsign=false"];
const DIRECTIVE_A = "# Directive revision A\nA queued packet pinned this revision.\n";
const DIRECTIVE_B = "# Directive revision B\nThe directive moved on after the packet was queued.\n";
const MISSPRINT = "ffd1452004753aa0f2b7ef21d990cb1df6e540c2850155b30dece990b8b82bd5";

function codesOf(report) {
  if (report && Array.isArray(report.errors)) return report.errors.map((error) => error.code);
  if (report && report.json && Array.isArray(report.json.errors)) return report.json.errors.map((error) => error.code);
  return [];
}

/** A disposable repository with two distinct `AGENTS.md` revisions in history. */
function makeDirectiveRepo() {
  const dir = createCleanRepo();
  const commitDirective = (content, message) => {
    fs.writeFileSync(path.join(dir, "AGENTS.md"), content);
    git(dir, ["add", "AGENTS.md"]);
    git(dir, [...GIT_IDENTITY, "commit", "-m", message]);
    return git(dir, ["rev-parse", "HEAD"]);
  };
  const tipA = commitDirective(DIRECTIVE_A, "directive A");
  const tipB = commitDirective(DIRECTIVE_B, "directive B");
  const blobA = git(dir, ["rev-parse", `${tipA}:AGENTS.md`]);
  const blobB = git(dir, ["rev-parse", `${tipB}:AGENTS.md`]);
  return { dir, tipA, tipB, blobA, blobB, hashA: lfSha256(Buffer.from(DIRECTIVE_A)), hashB: lfSha256(Buffer.from(DIRECTIVE_B)) };
}

function writePrompt(repo, name, body) {
  const abs = path.join(repo.dir, "docs", "prompts", name);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  return `docs/prompts/${name}`;
}

function pins(repo, args) {
  return runCli(PINS_CLI, [...args], { cwd: repo.dir });
}

// ---------------------------------------------------------------------------
// row 16 - the committed tree sweeps clean

test("row 16: pins check --all passes over the committed docs/prompts tree", () => {
  const result = runCli(PINS_CLI, ["check", "--all"], { cwd: REPO_ROOT });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.json.errors.length, 0);
  assert.ok(result.json.summary.checked > 0, "the sweep must actually inspect files");
});

// ---------------------------------------------------------------------------
// row 17-18 - A4: a queued historical pin survives, an unreproducible one fails

test("row 17: a non-current but reproducible directive pin passes after the directive is bumped", (t) => {
  const repo = makeDirectiveRepo();
  t.after(() => cleanupRepo(repo.dir));
  // The directive HAS moved on: the head blob is not the queued pin's blob.
  assert.notEqual(repo.hashA, repo.hashB);
  const queued = writePrompt(
    repo,
    "queued.md",
    `- Directive: \`origin/main:AGENTS.md\`, blob \`${repo.blobA}\`,\n  LF-SHA-256 \`${repo.hashA}\`.\n`,
  );
  const result = pins(repo, ["check", "--packet", queued]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.json.status, "ok");

  // The same packet would have failed if the pin were not reproducible at any
  // tip: the live directive hash is present, the misprint is not.
  const misprint = writePrompt(
    repo,
    "misprint.md",
    `- Directive: \`origin/main:AGENTS.md\`, blob \`${repo.blobA}\`, LF-SHA-256 \`${MISSPRINT}\`.\n`,
  );
  const failed = pins(repo, ["check", "--packet", misprint]);
  assert.equal(failed.status, 1);
  // The misprint fires both rules: it is not a known directive hash AND the
  // declared blob/hash pair disagrees.
  assert.deepEqual(codesOf(failed).sort(), ["PIN_DIRECTIVE_HASH_UNKNOWN", "PIN_HASH_MISMATCH"].sort());
});

test("row 18: a directive hash that reproduces at no tip fails closed", (t) => {
  const repo = makeDirectiveRepo();
  t.after(() => cleanupRepo(repo.dir));
  const packet = writePrompt(repo, "unknown-hash.md", `Directive: \`origin/main:AGENTS.md\`, LF-SHA-256 \`${"a".repeat(64)}\`.\n`);
  const result = pins(repo, ["check", "--packet", packet]);
  assert.equal(result.status, 1);
  assert.deepEqual(codesOf(result), ["PIN_DIRECTIVE_HASH_UNKNOWN"]);
});

// ---------------------------------------------------------------------------
// row 19 - unresolvable blob and mismatched pair

test("row 19: an unresolvable blob and a mismatched pin pair both fail", (t) => {
  const repo = makeDirectiveRepo();
  t.after(() => cleanupRepo(repo.dir));

  const missingBlob = writePrompt(repo, "missing-blob.md", `Directive: \`origin/main:AGENTS.md\`, blob \`${"0".repeat(40)}\`.\n`);
  const unresolved = pins(repo, ["check", "--packet", missingBlob]);
  assert.equal(unresolved.status, 1);
  assert.deepEqual(codesOf(unresolved), ["PIN_BLOB_UNRESOLVED"]);

  // A real blob paired with a real directive hash from a DIFFERENT revision: the
  // hash is reproducible, so only the pair recomputation can catch it.
  const mismatch = writePrompt(
    repo,
    "mismatch.md",
    `Directive: \`origin/main:AGENTS.md\`, blob \`${repo.blobA}\`, LF-SHA-256 \`${repo.hashB}\`.\n`,
  );
  const mismatched = pins(repo, ["check", "--packet", mismatch]);
  assert.equal(mismatched.status, 1);
  assert.deepEqual(codesOf(mismatched), ["PIN_HASH_MISMATCH"]);
});

// ---------------------------------------------------------------------------
// row 20 - scope discipline in both directions

test("row 20: marker-free hashes never fire, and the misprint on a directive line does", (t) => {
  const repo = makeDirectiveRepo();
  t.after(() => cleanupRepo(repo.dir));
  const H = "a51b62a2".padEnd(64, "0");
  const markerFree = writePrompt(
    repo,
    "scope.md",
    [
      `liveSemanticRevision \`${H}\``,
      `fixture fingerprint ${H}`,
      `A superseded directive value \`${MISSPRINT}\` on a line with no marker.`,
      "",
    ].join("\n"),
  );
  const clean = pins(repo, ["check", "--packet", markerFree]);
  assert.equal(clean.status, 0, clean.stdout + clean.stderr);

  // The same hash on a directive-marked line DOES fire, so the scope rule is a
  // boundary and not a blanket exemption.
  const marked = writePrompt(repo, "marked.md", `Directive: \`origin/main:AGENTS.md\`, LF-SHA-256 \`${H}\`.\n`);
  const fired = pins(repo, ["check", "--packet", marked]);
  assert.equal(fired.status, 1);
  assert.deepEqual(codesOf(fired), ["PIN_DIRECTIVE_HASH_UNKNOWN"]);
});

test("row 20 sweep: check --all reports only the genuine defects in a mixed tree", (t) => {
  const repo = makeDirectiveRepo();
  t.after(() => cleanupRepo(repo.dir));
  const H = "a51b62a2".padEnd(64, "0");
  writePrompt(repo, "clean.md", `liveSemanticRevision \`${H}\`\nA superseded directive value \`${MISSPRINT}\` with no directive marker.\n`);
  writePrompt(repo, "marked.md", `Directive: \`origin/main:AGENTS.md\`, LF-SHA-256 \`${H}\`.\n`);
  const sweep = pins(repo, ["check", "--all"]);
  assert.equal(sweep.status, 1, "the sweep must report the one genuine defect and none of the prose");
  assert.equal(sweep.json.summary.checked, 2);
  assert.deepEqual(codesOf(sweep), ["PIN_DIRECTIVE_HASH_UNKNOWN"]);
});

test("row 20 correction note (R1b direction ii): a quoted superseded value on a directive line never fires", (t) => {
  const repo = makeDirectiveRepo();
  t.after(() => cleanupRepo(repo.dir));

  // The exact published-immutability-c08r1 shape: one directive-marked line
  // carrying the corrected declaration AND, in prose, the full superseded value.
  const note = `- Directive pin: \`origin/main:AGENTS.md\`, blob \`${repo.blobA}\`, LF-SHA-256 \`${repo.hashA}\`. **Pin correction:** the previous value \`${MISSPRINT}\` reproduces at no \`AGENTS.md\` blob in reachable history.\n`;
  const packet = writePrompt(repo, "correction-note.md", note);
  const result = pins(repo, ["check", "--packet", packet]);
  assert.equal(result.status, 0, result.stdout + result.stderr);

  // The production instance of that shape sweeps clean too.
  const real = pins({ dir: REPO_ROOT }, ["check", "--packet", "docs/prompts/published-immutability-c08r1-2026-09-16.md"]);
  assert.equal(real.status, 0, real.stdout + real.stderr);

  // Direction (i): the same value in the DECLARED slot still fails closed.
  const declared = writePrompt(repo, "wrong-declared.md", `- Directive: \`origin/main:AGENTS.md\`, blob \`${repo.blobA}\`, LF-SHA-256 \`${MISSPRINT}\`.\n`);
  const fired = pins(repo, ["check", "--packet", declared]);
  assert.equal(fired.status, 1);
  assert.deepEqual(codesOf(fired).sort(), ["PIN_DIRECTIVE_HASH_UNKNOWN", "PIN_HASH_MISMATCH"].sort());

  // Direction (iii) is covered by row 17 above: a declared historical but
  // reproducible pin passes after the directive is bumped.
});

test("pins usage: a missing or conflicting selection is a usage error", () => {
  const none = runCli(PINS_CLI, ["check"], { cwd: REPO_ROOT });
  assert.equal(none.status, 2);
  assert.deepEqual(codesOf(none), ["USAGE_SELECTION_REQUIRED"]);
  const both = runCli(PINS_CLI, ["check", "--all", "--packet", "docs/prompts/x.md"], { cwd: REPO_ROOT });
  assert.equal(both.status, 2);
  const unknownOp = runCli(PINS_CLI, ["lint", "--all"], { cwd: REPO_ROOT });
  assert.equal(unknownOp.status, 2);
  assert.deepEqual(codesOf(unknownOp), ["USAGE_UNKNOWN_OP"]);
});

// ---------------------------------------------------------------------------
// rows 15 and 21 - directive-copy fail-closed at the registration path

function createStreamArgs(repo, observed, extra = []) {
  const specPath = path.join(repo.dir, "stream-spec.json");
  const spec = JSON.parse(JSON.stringify(stateDocFromFixture("pass-ordinary.json", repo).streams[0]));
  spec.id = "NEW-DIRECTIVE-1";
  spec.state = "REVIEW_REQUIRED";
  spec.running = [];
  spec.nextAction = "Await review.";
  spec.owners = { planner: { sessionId: null, status: "NONE", writable: false }, executor: { sessionId: null, status: "NONE", writable: false }, qa: { sessionId: null, status: "NONE", writable: false }, auditor: { sessionId: null, status: "NONE", writable: false } };
  fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
  return ["--stream-spec", specPath, "--observed-origin-main", observed, ...extra];
}

test("row 15 and 21: a matching directive copy registers, a stale or unresolvable one fails closed", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeStateDoc(repo, "directive-state.json", stateDocFromFixture("pass-ordinary.json", repo, (d) => { d.registry.revision = 1; }));

  // Positive control: the disposable repository's operating copy matches the
  // observed tip, so registration proceeds.
  const ok = runCli(TRANSITION_CLI, ["--state", statePath, "--transition", "create-stream", ...createStreamArgs(repo, repo.candidateSha), "--expect-revision", "1"], { cwd: repo.dir });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.equal(JSON.parse(fs.readFileSync(statePath, "utf8")).streams.length, 2);

  // A tip that carries no AGENTS.md must never be a silent skip.
  const stateTwo = writeStateDoc(repo, "directive-state-2.json", stateDocFromFixture("pass-ordinary.json", repo, (d) => { d.registry.revision = 1; }));
  const unresolved = runCli(TRANSITION_CLI, ["--state", stateTwo, "--transition", "create-stream", ...createStreamArgs(repo, repo.otherSha), "--expect-revision", "1"], { cwd: repo.dir });
  assert.equal(unresolved.status, 1);
  assert.deepEqual(codesOf(unresolved), ["DIRECTIVE_REMOTE_UNRESOLVED"]);

  // A stale operating copy fails closed with zero mutation.
  const stateThree = writeStateDoc(repo, "directive-state-3.json", stateDocFromFixture("pass-ordinary.json", repo, (d) => { d.registry.revision = 1; }));
  const before = fs.readFileSync(stateThree);
  fs.writeFileSync(path.join(repo.dir, "AGENTS.md"), "# Directive revision Z\nA stale operating copy.\n");
  const stale = runCli(TRANSITION_CLI, ["--state", stateThree, "--transition", "create-stream", ...createStreamArgs(repo, repo.candidateSha), "--expect-revision", "1"], { cwd: repo.dir });
  assert.equal(stale.status, 1);
  assert.deepEqual(codesOf(stale), ["DIRECTIVE_COPY_STALE"]);
  assert.deepEqual(fs.readFileSync(stateThree), before, "a stale directive copy must not mutate the register");
  const verified = runCli(VERIFY_CLI, ["--state", stateThree], { cwd: repo.dir });
  assert.equal(verified.status, 0, "the untouched register stays verifier-clean");
});

// ---------------------------------------------------------------------------
// section 3.6 - LF-normalized dependency identity

test("section 3.6: deps compare is LF-normalized and still detects a real difference", (t) => {
  const dir = fs.mkdtempSync(path.join(REPO_ROOT, ".wfc10-deps-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const lf = path.join(dir, "lf.json");
  const crlf = path.join(dir, "crlf.json");
  const other = path.join(dir, "other.json");
  const body = '{ "name": "fixture", "lockfileVersion": 3 }\n';
  fs.writeFileSync(lf, body);
  fs.writeFileSync(crlf, body.replace(/\n/g, "\r\n"));
  fs.writeFileSync(other, '{ "name": "fixture", "lockfileVersion": 2 }\n');

  const identity = runCli(DEPS_CLI, ["identity", lf], { cwd: REPO_ROOT });
  assert.equal(identity.status, 0, identity.stdout + identity.stderr);
  assert.equal(identity.json.summary.sha256, lfSha256(Buffer.from(body)));

  const equal = runCli(DEPS_CLI, ["compare", lf, crlf], { cwd: REPO_ROOT });
  assert.equal(equal.status, 0, "a CRLF materialization must not read as a different dependency tree");
  assert.equal(equal.json.summary.equal, true);

  const different = runCli(DEPS_CLI, ["compare", lf, other], { cwd: REPO_ROOT });
  assert.equal(different.status, 1);
  assert.deepEqual(codesOf(different), ["DEPS_IDENTITY_DIFFERENT"]);

  const usage = runCli(DEPS_CLI, ["compare", lf], { cwd: REPO_ROOT });
  assert.equal(usage.status, 2);
  const unknown = runCli(DEPS_CLI, ["hash", lf], { cwd: REPO_ROOT });
  assert.equal(unknown.status, 2);
});

// ---------------------------------------------------------------------------
// The lint rule is shared by the CLI and the engine

test("the lint implementation used by the CLI is the engine's own resolver", () => {
  const resolvers = gitPinResolvers(REPO_ROOT);
  const misprint = `- Directive: \`origin/main:AGENTS.md\`, blob \`051ad26a07509e3af4f1c1762e1ccfff8bb6cc88\`, LF-SHA-256 \`${MISSPRINT}\`.\n`;
  assert.deepEqual(
    lintDirectivePins(misprint, resolvers).map((error) => error.code).sort(),
    ["PIN_HASH_MISMATCH", "PIN_DIRECTIVE_HASH_UNKNOWN"].sort(),
  );
});
