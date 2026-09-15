import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  VERIFY_CLI,
  SCHEMA_FILE,
  getSharedRepo,
  fixtureRaw,
  repoSubstitutions,
  substitute,
  writeState,
  runCli,
  errorCodes,
  copyWorkflowToTemp,
} from "./harness.mjs";

function validStatePath(repo) {
  return writeState(repo, "state.json", substitute(fixtureRaw("pass-ordinary.json"), repoSubstitutions(repo)));
}

test("a missing schema file fails closed with SCHEMA_LOAD_FAILED", (t) => {
  const tree = copyWorkflowToTemp();
  t.after(() => fs.rmSync(tree.dir, { recursive: true, force: true }));
  fs.rmSync(tree.schemaFile, { force: true });

  const repo = getSharedRepo();
  const statePath = validStatePath(repo);

  const result = runCli(tree.verifyCli, ["--state", statePath], { cwd: repo.dir });
  assert.equal(result.status, 1);
  assert.deepEqual(errorCodes(result), ["SCHEMA_LOAD_FAILED"]);
});

test("an unparseable schema file fails closed with SCHEMA_LOAD_FAILED", (t) => {
  const tree = copyWorkflowToTemp();
  t.after(() => fs.rmSync(tree.dir, { recursive: true, force: true }));
  fs.writeFileSync(tree.schemaFile, "{ not json");

  const repo = getSharedRepo();
  const statePath = validStatePath(repo);

  const result = runCli(tree.verifyCli, ["--state", statePath], { cwd: repo.dir });
  assert.equal(result.status, 1);
  assert.deepEqual(errorCodes(result), ["SCHEMA_LOAD_FAILED"]);
});

test("an unsupported schema keyword fails closed with SCHEMA_UNSUPPORTED_KEYWORD", (t) => {
  const tree = copyWorkflowToTemp();
  t.after(() => fs.rmSync(tree.dir, { recursive: true, force: true }));
  const schema = JSON.parse(fs.readFileSync(tree.schemaFile, "utf8"));
  schema.format = "date-time";
  fs.writeFileSync(tree.schemaFile, `${JSON.stringify(schema)}\n`);

  const repo = getSharedRepo();
  const statePath = validStatePath(repo);

  const result = runCli(tree.verifyCli, ["--state", statePath], { cwd: repo.dir });
  assert.equal(result.status, 1);
  assert.deepEqual(errorCodes(result), ["SCHEMA_UNSUPPORTED_KEYWORD"]);
});

test("the shipped schema is a 2020-12 document with the frozen contract version", () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.properties.contractVersion.const, "1.2.0");
  assert.equal(schema.additionalProperties, false);
});

test("the schema no longer expresses a remoteSha self-reference (A1)", () => {
  const raw = fs.readFileSync(SCHEMA_FILE, "utf8");
  assert.equal(/"remoteSha"/.test(raw), false, "the ambiguous remoteSha field must be gone");
  const schema = JSON.parse(raw);
  assert.deepEqual(schema.$defs.git.required.includes("remoteObservation"), true);
  assert.deepEqual(schema.$defs.git.required.includes("remoteSha"), false);
});

test("the schema carries the CAS revision and the lease array (A3)", () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, "utf8"));
  assert.equal(schema.required.includes("leases"), true);
  assert.equal(schema.properties.leases.type, "array");
  assert.deepEqual(schema.$defs.lease.properties.state.enum, ["ACTIVE", "RETURNED", "IDLE", "ERROR", "STALE_UNCONFIRMED"]);
  assert.equal(schema.properties.registry.required.includes("revision"), true);
});

test("unknown top-level keys are rejected by the schema", (t) => {
  const repo = getSharedRepo();
  const doc = JSON.parse(substitute(fixtureRaw("pass-ordinary.json"), repoSubstitutions(repo)));
  doc.unexpectedTopLevelKey = true;
  const statePath = writeState(repo, "unknown-key.json", `${JSON.stringify(doc)}\n`);

  const result = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(result.status, 1);
  assert.ok(errorCodes(result).includes("SCHEMA_UNKNOWN_KEY"), JSON.stringify(errorCodes(result)));
});

test("unknown nested stream keys are rejected by the schema", (t) => {
  const repo = getSharedRepo();
  const doc = JSON.parse(substitute(fixtureRaw("pass-ordinary.json"), repoSubstitutions(repo)));
  doc.streams[0].unexpectedNestedKey = 1;
  const statePath = writeState(repo, "unknown-nested.json", `${JSON.stringify(doc)}\n`);

  const result = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(result.status, 1);
  assert.ok(errorCodes(result).includes("SCHEMA_UNKNOWN_KEY"), JSON.stringify(errorCodes(result)));
});

test("a missing required key is rejected by the schema", (t) => {
  const repo = getSharedRepo();
  const doc = JSON.parse(substitute(fixtureRaw("pass-ordinary.json"), repoSubstitutions(repo)));
  delete doc.streams[0].objective;
  const statePath = writeState(repo, "missing-key.json", `${JSON.stringify(doc)}\n`);

  const result = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(result.status, 1);
  assert.ok(errorCodes(result).includes("SCHEMA_REQUIRED"), JSON.stringify(errorCodes(result)));
});

test("a drive-qualified changed path is rejected by the path pattern", (t) => {
  const repo = getSharedRepo();
  const doc = JSON.parse(substitute(fixtureRaw("pass-ordinary.json"), repoSubstitutions(repo)));
  doc.streams[0].git.changedPaths = ["C:/absolute/path.ts"];
  const statePath = writeState(repo, "bad-path.json", `${JSON.stringify(doc)}\n`);

  const result = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(result.status, 1);
  assert.ok(errorCodes(result).includes("SCHEMA_PATTERN"), JSON.stringify(errorCodes(result)));
});
