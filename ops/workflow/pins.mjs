#!/usr/bin/env node
// ops/workflow/pins.mjs
// Packet-artifact pin lint (WF-C10 section 3.5).
//
//   node ops/workflow/pins.mjs check --packet <repo-relative path>
//   node ops/workflow/pins.mjs check --all
//
// Exit codes: 0 pass, 1 pin/usage-independent failure, 2 usage error.
// Exactly one JSON object is printed, matching every other workflow CLI.
//
// `check --all` sweeps docs/prompts/**. The point of the rule is the A4
// requirement: a historical but reproducible directive pin PASSES, so a later
// directive bump never invalidates an already-queued packet, while a pin that
// reproduces at no tip fails closed.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { resolveRepoRoot } from "./lib/git.mjs";
import { gitPinResolvers, lintDirectivePins } from "./lib/directive.mjs";
import { resolveRepoRelativeFile } from "./lib/paths.mjs";

const PROMPTS_REL = "docs/prompts";

function emit(report) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function fail(code, message, errPath = "$", summary = {}) {
  return {
    status: "fail",
    summary: { checked: summary.checked || 0, errors: 1, ...summary },
    nextActions: [],
    artifacts: [],
    errors: [{ code, message, path: errPath }],
  };
}

function usage(code, message) {
  return fail(code, message, "$");
}

function parse(argv) {
  const out = { op: argv[0] || null, packet: null, all: false };
  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--all") {
      if (out.all) return { ok: false };
      out.all = true;
      continue;
    }
    if (token === "--packet") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) return { ok: false, code: "USAGE_MISSING_VALUE_PACKET" };
      if (out.packet !== null) return { ok: false, code: "USAGE_DUPLICATE_FLAG" };
      out.packet = next;
      i += 1;
      continue;
    }
    return { ok: false, code: "USAGE_UNKNOWN_FLAG" };
  }
  return { ok: true, ...out };
}

const parsed = parse(process.argv.slice(2));
if (!parsed.ok) {
  emit(usage(parsed.code || "USAGE_UNKNOWN_FLAG", `invalid arguments (${parsed.code || "USAGE_UNKNOWN_FLAG"})`));
  process.exit(2);
}
if (parsed.op !== "check") {
  emit(usage("USAGE_UNKNOWN_OP", `the only operation is "check"; got ${JSON.stringify(parsed.op)}`));
  process.exit(2);
}
if (parsed.all === (parsed.packet !== null)) {
  emit(usage("USAGE_SELECTION_REQUIRED", "check requires exactly one of --packet <path> or --all"));
  process.exit(2);
}

const repoRoot = resolveRepoRoot(process.cwd());
if (!repoRoot) {
  emit(fail("PIN_REPO_UNAVAILABLE", "no Git repository could be resolved from the working directory", "$.repoRoot"));
  process.exit(1);
}

const resolvers = gitPinResolvers(repoRoot);

function collectPromptFiles(dirAbs, collected = []) {
  let entries;
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch {
    return collected;
  }
  for (const entry of [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const abs = path.join(dirAbs, entry.name);
    if (entry.isDirectory()) collectPromptFiles(abs, collected);
    else if (entry.isFile() && entry.name.endsWith(".md")) collected.push(abs);
  }
  return collected;
}

if (parsed.all) {
  const promptsDir = path.join(repoRoot, ...PROMPTS_REL.split("/"));
  const files = collectPromptFiles(promptsDir);
  const errors = [];
  for (const abs of files) {
    const rel = path.relative(repoRoot, abs).split(path.sep).join("/");
    let body;
    try {
      body = fs.readFileSync(abs, "utf8");
    } catch (err) {
      errors.push({ code: "PIN_PACKET_UNRESOLVED", message: `could not read ${rel}: ${err.message}`, path: rel });
      continue;
    }
    for (const error of lintDirectivePins(body, resolvers)) {
      errors.push({ ...error, path: `${rel}:${error.path}` });
    }
  }
  const summary = { checked: files.length, errors: errors.length, repoRoot, scope: PROMPTS_REL };
  if (errors.length === 0) {
    emit({ status: "ok", summary, nextActions: [], artifacts: [], errors: [] });
    process.exit(0);
  }
  emit({ status: "fail", summary: { ...summary, errors: errors.length }, nextActions: [], artifacts: [], errors });
  process.exit(1);
}

const resolved = resolveRepoRelativeFile(repoRoot, parsed.packet);
if (!resolved.ok) {
  emit(fail("PIN_PACKET_UNRESOLVED", `--packet ${parsed.packet}: ${resolved.message}`, parsed.packet));
  process.exit(1);
}
const rel = path.relative(repoRoot, resolved.absPath).split(path.sep).join("/");
const errors = lintDirectivePins(resolved.bytes.toString("utf8"), resolvers).map((error) => ({
  ...error,
  path: `${rel}:${error.path}`,
}));
const summary = { checked: 1, errors: errors.length, repoRoot, packet: rel };
if (errors.length === 0) {
  emit({ status: "ok", summary, nextActions: [], artifacts: [], errors: [] });
  process.exit(0);
}
emit({ status: "fail", summary, nextActions: [], artifacts: [], errors });
process.exit(1);
