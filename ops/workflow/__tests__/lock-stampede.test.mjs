// S1/S3 — claim-serialized lock reclaim under a synchronized stampede.
//
// Four persistent OS worker processes contend for the real lock file across
// many rounds. A short-lived process supplies a provably dead owner pid, the
// parent re-seeds a dead record each round, and every worker starts its acquire
// at the same file barrier instant, so the interleaving is genuine (not
// cooperative) while process startup is paid once per worker.
//
// The worker module is resolved from THIS file's location (`../lib/lock.mjs`),
// so running this same test file against a disposable copy of the workflow tree
// exercises that copy's lock implementation.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createTempRepo, cleanupRepo } from "./harness.mjs";
import { lockPathFor, classifyLock, processAlive } from "../lib/lock.mjs";

const LIB_URL = new URL("../lib/lock.mjs", import.meta.url).href;
const repo = createTempRepo();
process.on("exit", () => cleanupRepo(repo.dir));

const LOCK = lockPathFor(repo.dir);
// Derived rather than imported so this identical harness also runs against a
// disposable copy whose lock implementation predates the claim mutex.
const CLAIM = `${LOCK}.claim`;
const LOCK_DIR = path.dirname(LOCK);
const MANY_WRITERS = 6;

function deadPid() {
  const res = spawnSync(process.execPath, ["-e", "process.exit(0)"], { windowsHide: true });
  return res.pid;
}

// Resolved once: the process has long since exited, and `stampedeRound`
// re-asserts `classifyLock(...).kind === "ABSENT"` before every round, so a
// (vanishingly unlikely) pid reuse would fail the test loudly rather than pass.
const DEAD_PID = deadPid();

function writeDeadLock(pid, padding) {
  const record = {
    schema: "atlas.workflow.lock/1",
    ownerPid: pid,
    ownerHost: "stampede-host",
    transition: "dead-holder",
    streamId: null,
    statePath: null,
    acquiredAt: new Date().toISOString(),
  };
  if (padding) record.padding = "x".repeat(padding);
  fs.writeFileSync(LOCK, `${JSON.stringify(record, null, 2)}\n`);
}

function residue() {
  const out = [];
  if (fs.existsSync(CLAIM)) out.push(CLAIM);
  for (const name of fs.readdirSync(LOCK_DIR)) {
    if (name.startsWith("atlas-workflow.lock") && name.endsWith(".tmp")) out.push(path.join(LOCK_DIR, name));
  }
  return out;
}

function clearResidue() {
  for (const file of [LOCK, CLAIM, ...residue()]) {
    try {
      fs.unlinkSync(file);
    } catch {
      /* absent */
    }
  }
}

const WORKER = `
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
const mod = await import(process.env.WF_LOCK_MODULE);
let held = null;
const rl = readline.createInterface({ input: process.stdin });
for await (const line of rl) {
  const command = line.trim();
  if (command === "EXIT") break;
  if (command === "RELEASE") {
    if (held) { mod.releaseLock(held); held = null; }
    process.stdout.write(JSON.stringify({ phase: "released" }) + "\\n");
    continue;
  }
  if (!command.startsWith("ROUND ")) continue;
  const barrier = command.slice(6);
  process.stdout.write(JSON.stringify({ phase: "ready" }) + "\\n");
  const spinDeadline = Date.now() + 10000;
  while (!fs.existsSync(path.join(barrier, "go"))) {
    if (Date.now() > spinDeadline) break;
  }
  const result = mod.acquireLock({ repoRoot: process.env.WF_LOCK_REPO, transition: "stampede", maxInspect: 3, backoffMs: 6 });
  if (result.ok) held = result;
  process.stdout.write(JSON.stringify({ phase: "result", ok: !!result.ok, code: result.code || null, message: result.message ? String(result.message).slice(0, 200) : null }) + "\\n");
}
process.exit(0);
`;

const ONE_SHOT = `
const mod = await import(process.env.WF_LOCK_MODULE);
const result = mod.acquireLock({
  repoRoot: process.env.WF_LOCK_REPO,
  transition: "claim-blocked",
  maxInspect: Number(process.env.WF_MAX_INSPECT),
  backoffMs: Number(process.env.WF_BACKOFF_MS),
});
process.stdout.write(JSON.stringify({ ok: !!result.ok, code: result.code || null, message: result.message || "" }));
`;

// `node -` consumes stdin as the program source, so persistent workers must run
// from a file to keep stdin free for commands.
const WORKER_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "wf-lock-workers-"));
const WORKER_FILE = path.join(WORKER_DIR, "worker.mjs");
const ONE_SHOT_FILE = path.join(WORKER_DIR, "one-shot.mjs");
fs.writeFileSync(WORKER_FILE, WORKER);
fs.writeFileSync(ONE_SHOT_FILE, ONE_SHOT);
process.on("exit", () => {
  try {
    fs.rmSync(WORKER_DIR, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

function startWorker() {
  const child = spawn(process.execPath, [WORKER_FILE], {
    env: { ...process.env, WF_LOCK_MODULE: LIB_URL, WF_LOCK_REPO: repo.dir },
    windowsHide: true,
  });
  const queue = [];
  const waiters = [];
  let buffer = "";
  let stderrText = "";
  let closed = false;
  child.stdout.on("data", (d) => {
    buffer += d;
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        parsed = { ok: false, code: "WORKER_PARSE_FAILED" };
      }
      const waiter = waiters.shift();
      if (waiter) waiter(parsed);
      else queue.push(parsed);
    }
  });
  child.stderr.on("data", (d) => {
    stderrText += d;
  });
  child.on("close", () => {
    closed = true;
    while (waiters.length) waiters.shift()({ ok: false, code: "WORKER_EXITED", stderr: stderrText.slice(-400) });
  });
  return {
    child,
    stderr() {
      return stderrText.slice(-400);
    },
    round(barrier) {
      child.stdin.write(`ROUND ${barrier}\n`);
    },
    release() {
      try {
        child.stdin.write("RELEASE\n");
      } catch {
        /* already gone */
      }
    },
    next(timeoutMs = 15000) {
      if (queue.length) return Promise.resolve(queue.shift());
      if (closed) return Promise.resolve({ ok: false, code: "WORKER_EXITED" });
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve({ ok: false, code: "WORKER_TIMEOUT" }), timeoutMs);
        waiters.push((value) => {
          clearTimeout(timer);
          resolve(value);
        });
      });
    },
    close() {
      try {
        child.stdin.write("EXIT\n");
        child.stdin.end();
      } catch {
        /* already gone */
      }
    },
  };
}

async function stampedeRound(workers, padding) {
  clearResidue();
  const barrier = fs.mkdtempSync(path.join(os.tmpdir(), "wf-barrier-"));
  const pid = DEAD_PID;
  writeDeadLock(pid, padding);
  const seeded = classifyLock(LOCK);
  assert.equal(seeded.kind, "ABSENT", `pid ${pid} must classify ABSENT (padding=${padding})`);
  assert.equal(processAlive(pid), false, "the seeded owner pid must be provably absent");

  for (const worker of workers) worker.round(barrier);
  // Event-driven barrier: the workers announce readiness on stdout and the
  // parent releases them with a `go` file, so no polling timer is involved
  // (Windows timer granularity is ~15 ms and dominated the round cost).
  await Promise.all(workers.map((worker) => worker.next()));
  fs.writeFileSync(path.join(barrier, "go"), "");

  const results = await Promise.all(workers.map((worker) => worker.next()));
  const winners = results.filter((r) => r.ok).length;
  const losers = results.filter((r) => !r.ok);
  // The winner holds until the round ends, so no late loser can ever acquire.
  for (const worker of workers) worker.release();
  await Promise.all(workers.map((worker) => worker.next()));
  const leftover = residue();
  clearResidue();
  fs.rmSync(barrier, { recursive: true, force: true });
  return { winners, losers: losers.length, codes: losers.map((r) => r.code), leftover, raw: results, released: !fs.existsSync(LOCK) };
}

test("S1 stampede: exactly one acquirer wins from a dead-owner lock (20 rounds + a widened record)", async () => {
  const workers = Array.from({ length: MANY_WRITERS }, () => startWorker());
  try {
    const summary = [];
    for (let round = 0; round < 20; round += 1) {
      const padding = round === 19 ? 1_000_000 : 0;
      const outcome = await stampedeRound(workers, padding);
      summary.push({ round, padding, winners: outcome.winners, codes: outcome.codes });
      assert.deepEqual(outcome.leftover, [], `round ${round} left lock/claim/temp residue`);
      assert.equal(
        outcome.winners,
        1,
        `round ${round} (padding=${padding}) produced ${outcome.winners} winners: ${JSON.stringify(outcome.raw)}`,
      );
      assert.equal(outcome.losers, MANY_WRITERS - 1, `round ${round} must have exactly ${MANY_WRITERS - 1} typed losers`);
      for (const code of outcome.codes) {
        assert.ok(
          ["LOCK_CONTENTION", "LOCK_UNREADABLE"].includes(code),
          `round ${round} loser must carry a typed lock error, got ${JSON.stringify(outcome.raw.filter((r) => !r.ok))}`,
        );
      }
    }
    assert.deepEqual(
      summary.filter((s) => s.winners !== 1),
      [],
      "no round may ever produce more than one winner",
    );
  } finally {
    for (const worker of workers) worker.close();
  }
});

test("S3 a stale claim file blocks reclaim fail-closed and is never auto-deleted", async () => {
  clearResidue();
  const pid = DEAD_PID;
  writeDeadLock(pid, 0);
  const lockBefore = fs.readFileSync(LOCK);
  fs.writeFileSync(CLAIM, "");
  const claimBefore = fs.readFileSync(CLAIM);

  const blocked = await oneShotWorker(2, 10);
  assert.equal(blocked.ok, false, "a stale claim must prevent acquisition");
  assert.equal(blocked.code, "LOCK_CONTENTION");
  assert.match(blocked.message, /claim file/);
  assert.deepEqual(fs.readFileSync(LOCK), lockBefore, "the dead lock must be untouched");
  assert.deepEqual(fs.readFileSync(CLAIM), claimBefore, "a stale claim is never auto-deleted");
  clearResidue();

  // After a normal reclaim the claim file is released in `finally`.
  const workers = Array.from({ length: MANY_WRITERS }, () => startWorker());
  try {
    const outcome = await stampedeRound(workers, 0);
    assert.equal(outcome.winners, 1);
    assert.deepEqual(outcome.leftover, [], "no claim residue after a normal reclaim");
  } finally {
    for (const worker of workers) worker.close();
  }
});

function oneShotWorker(maxInspect, backoffMs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [ONE_SHOT_FILE], {
      env: {
        ...process.env,
        WF_LOCK_MODULE: LIB_URL,
        WF_LOCK_REPO: repo.dir,
        WF_MAX_INSPECT: String(maxInspect),
        WF_BACKOFF_MS: String(backoffMs),
      },
      windowsHide: true,
    });
    let out = "";
    child.stdout.on("data", (d) => {
      out += d;
    });
    child.stderr.on("data", (d) => {
      out += d;
    });
    child.on("close", () => {
      try {
        resolve(JSON.parse(out));
      } catch {
        resolve({ ok: false, code: "WORKER_PARSE_FAILED", message: out });
      }
    });
  });
}
