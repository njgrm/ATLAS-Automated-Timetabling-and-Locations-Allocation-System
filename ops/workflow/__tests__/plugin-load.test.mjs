// WF-C03 (gate 6) — plugin load, host-safety, and installed-version discovery.
//
// The plugin is a thin wrapper over `ops/workflow/lib/observability.mjs`; these
// rows prove it imports as a module, exposes only the documented hooks, never
// throws into the host, holds no execution/browser authority, and is resolved by
// the installed OpenCode from `.opencode/plugins/`.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, getSharedRepo } from "./harness.mjs";
import { SUBSCRIBED_EVENTS } from "../lib/observability.mjs";

const PLUGIN = path.join(REPO_ROOT, ".opencode", "plugins", "atlas-observability.ts");
const PLUGIN_URL = pathToFileURL(PLUGIN).href;

test("the plugin module imports and exposes exactly the documented hooks", async () => {
  assert.ok(fs.existsSync(PLUGIN), `the plugin must exist at ${PLUGIN}`);
  const mod = await import(PLUGIN_URL);
  assert.equal(typeof mod.default, "function");
  assert.equal(typeof mod.AtlasObservabilityPlugin, "function", "the named export must match the default");

  const hooks = await mod.default({ directory: REPO_ROOT });
  assert.deepEqual(Object.keys(hooks).sort(), ["event", "tool.execute.before"]);
  assert.equal(typeof hooks.event, "function");
  assert.equal(typeof hooks["tool.execute.before"], "function");
});

test("the plugin holds no execution, network, or browser authority", () => {
  const source = fs.readFileSync(PLUGIN, "utf8");
  const forbidden = [
    "child_process",
    "spawnSync",
    "execFile",
    "exec(",
    "fetch(",
    "node:net",
    "node:http",
    "node:https",
    "node:dns",
    "playwright",
    "localStorage",
    "sessionStorage",
  ];
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `the plugin must not reference ${token}`);
  }
});

test("the plugin and the library agree on the subscribed event inventory", () => {
  assert.deepEqual(
    [...SUBSCRIBED_EVENTS].sort(),
    [
      "permission.asked",
      "permission.replied",
      "session.compacted",
      "session.created",
      "session.deleted",
      "session.error",
      "session.idle",
      "session.status",
      "session.updated",
    ].sort(),
  );
});

test("hostile hook input never throws into the host", async () => {
  const mod = await import(PLUGIN_URL);
  const hooks = await mod.default({});
  // No directory, no session id, and no tool: each path must be a guarded no-op.
  await hooks.event({ event: null });
  await hooks.event({});
  await hooks.event({ event: { type: "not.a.real.event", properties: { sessionID: "ses_x" } } });
  await hooks.event({ event: { type: "session.error", properties: {} } });
  await hooks["tool.execute.before"](null);
  await hooks["tool.execute.before"]({ sessionID: "ses_x" });
  await hooks["tool.execute.before"]({ tool: "bash" });
});

test("the plugin records a heartbeat and a sanitized last action through its real hooks", async (t) => {
  const repo = getSharedRepo();
  const obsRoot = path.join(repo.dir, ".git", "atlas-observability");
  t.after(() => {
    try {
      fs.rmSync(obsRoot, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  });

  const mod = await import(PLUGIN_URL);
  const hooks = await mod.default({ directory: repo.dir });
  const sessionId = "ses_plugin_wfc03";

  await hooks.event({ event: { type: "session.created", properties: { info: { id: sessionId } } } });
  const file = path.join(obsRoot, "sessions", `${sessionId}.json`);
  assert.ok(fs.existsSync(file), "a subscribed session event must create a heartbeat");

  await hooks["tool.execute.before"]({ sessionID: sessionId, tool: "bash" });
  const stored = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(stored.sessionId, sessionId);
  assert.equal(stored.lastAtomicAction, "bash");
  assert.equal(JSON.stringify(stored).includes("command"), false, "tool arguments must never be stored");
});

test("the installed OpenCode resolves this exact plugin file", (t) => {
  const version = spawnSync("opencode", ["--version"], { encoding: "utf8", windowsHide: true, shell: true, timeout: 60000 });
  if (version.error || version.status !== 0) {
    t.skip(`the opencode CLI is unavailable in this environment: ${version.error ? version.error.message : version.status}`);
    return;
  }
  const reported = `${version.stdout || ""}`.trim();

  const resolved = spawnSync("opencode", ["debug", "config"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    windowsHide: true,
    shell: true,
    timeout: 120000,
  });
  const output = `${resolved.stdout || ""}\n${resolved.stderr || ""}`;
  assert.equal(resolved.status, 0, `opencode debug config failed (${reported}): ${output.slice(0, 800)}`);
  assert.ok(
    /file:\/\/\/[^"\s]*\.opencode\/plugins\/atlas-observability\.ts/.test(output),
    `the installed OpenCode (${reported}) must resolve .opencode/plugins/atlas-observability.ts into the plugin array`,
  );
});

// WF-C10 section 3.3 (A3, rows 27-28). The plugin is an ESM module. The root
// `package.json` is `"type": "commonjs"`, and with no nearer package root Node
// parses the plugin's `import` statements as CommonJS, so the row fails with
// `SyntaxError: Cannot use import statement outside a module`. Tracking
// `.opencode/package.json` with `"type": "module"` is the fix; it is NOT a
// missing dependency. These rows reproduce the real cause hermetically (a root
// package scope that declares CommonJS, no node_modules anywhere) and prove the
// fix is causal by removing exactly that one file from an identical tree.
function buildCheckout(root, { rootPackageJson, openCodePackageJson }) {
  if (rootPackageJson !== null) {
    fs.writeFileSync(path.join(root, "package.json"), rootPackageJson);
  }
  fs.cpSync(path.join(REPO_ROOT, ".opencode", "plugins"), path.join(root, ".opencode", "plugins"), { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, "ops", "workflow", "lib"), path.join(root, "ops", "workflow", "lib"), { recursive: true });
  if (openCodePackageJson !== null) {
    fs.writeFileSync(path.join(root, ".opencode", "package.json"), openCodePackageJson);
  }
  return path.join(root, ".opencode", "plugins", "atlas-observability.ts");
}

test("A3 row 27: the tracked .opencode/package.json makes a fresh checkout load the plugin", async (t) => {
  const trackedPath = path.join(REPO_ROOT, ".opencode", "package.json");
  assert.ok(fs.existsSync(trackedPath), "the tracked OpenCode package root must exist");
  const trackedBody = fs.readFileSync(trackedPath, "utf8");
  assert.equal(JSON.parse(trackedBody).type, "module", 'the load-bearing field is "type": "module"');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wfc10-fresh-checkout-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const pluginPath = buildCheckout(root, { rootPackageJson: JSON.stringify({ type: "commonjs" }), openCodePackageJson: trackedBody });
  assert.equal(fs.existsSync(path.join(root, ".opencode", "node_modules")), false, "a fresh checkout has no node_modules");

  const mod = await import(pathToFileURL(pluginPath).href);
  assert.equal(typeof mod.default, "function");
  const hooks = await mod.default({ directory: root });
  assert.deepEqual(Object.keys(hooks).sort(), ["event", "tool.execute.before"]);
});

test("A3 row 28: an identical tree without the tracked package root reproduces the failure", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wfc10-mutant-checkout-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  // Identical tree and root package type; only `.opencode/package.json` is absent.
  const pluginPath = buildCheckout(root, { rootPackageJson: JSON.stringify({ type: "commonjs" }), openCodePackageJson: null });

  await assert.rejects(
    () => import(pathToFileURL(pluginPath).href),
    (error) => /Cannot use import statement outside a module/.test(String((error && error.message) || "")),
    "without the tracked package root the identical tree must reproduce the ESM-in-CommonJS failure",
  );
});
