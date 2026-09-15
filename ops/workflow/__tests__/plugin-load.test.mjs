// WF-C03 (gate 6) — plugin load, host-safety, and installed-version discovery.
//
// The plugin is a thin wrapper over `ops/workflow/lib/observability.mjs`; these
// rows prove it imports as a module, exposes only the documented hooks, never
// throws into the host, holds no execution/browser authority, and is resolved by
// the installed OpenCode from `.opencode/plugins/`.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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
