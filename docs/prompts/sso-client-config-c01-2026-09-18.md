# SSO-CLIENT-CONFIG-C01 — make the companion SSO configuration real at build time

- Stream: `SSO-CLIENT-CONFIG-C01`
- Kind: `CYCLE`, source + build configuration. Risk: `MEDIUM` source. Rebuilding and
  redeploying the release is a separate `HIGH` action and is NOT authorized here.
- Base: `bb13e574` (re-verify; main is moving)
- Writable worktree: `E:/ATLAS-worktrees/sso-client-config-c01` (planner-provisioned)
- Branch: `work/sso-client-config-c01`
- Additive commits only.
- Recommended executor reasoning: `high`.
- Supersedes `SSO-ENV-ACTIVATION-C01` (`PLANNED`, stale — it pins live release
  `8eb0511b`, which no longer exists).

## 0. Root cause (diagnosed 2026-09-18, from the served bundle)

The companion-SSO code **is** on `origin/main` and **is** deployed: `3e0103a3`,
`fbb9dc63`, `c989f03d` are all ancestors; server routes live in
`atlas-server/src/routes/auth.router.ts` backed by
`services/companion-sso.service.ts`; client surfaces are
`lib/companion-config.ts`, `lib/companion-sso-client.ts`, `pages/SsoCallback.tsx`,
`components/app-shell/IntegratedSystems.tsx`.

**The runtime env is not the problem.** `D:\ATLAS-runtime-config\atlas-server.env`
carries all four SSO keys plus the EnrollPro keys, and they were loaded when the
runtime was restarted for the `74c1f12a` deploy.

**The problem is client build-time configuration.** `lib/companion-config.ts`
resolves the EnrollPro origin from `VITE_ENROLLPRO_URL` — a **Vite build-time**
variable:

```ts
export function resolveEnrollProBase(env = viteEnv()): string | null {
  const raw = env.VITE_ENROLLPRO_URL?.trim();
  if (!raw) return null;          // fail-closed by design: no raw-IP fallback
  return raw.replace(/\/+$/, '');
}
```

Evidence from the actually-served bundle (`assets/index-CtOKnF1z.js`, 416,337 bytes):

| Needle | Occurrences |
| --- | --- |
| `dev-jegs` (the EnrollPro origin) | **0** |
| `atlas/reverse/start` (the path constant) | 1 |
| `VITE_ENROLLPRO_URL` (as a literal property name) | 1 |

The bundle carries the *path* but **no origin**, so `resolveEnrollProBase()`
returns `null`, every companion surface disables or omits itself, and the
Integrated Systems area renders as "not configured". That is exactly the reported
symptom: *"our app shell is not configured and EnrollPro cannot access even though
our env is already correct."*

**Contributing defect — CORRECTED BY QA, and the correction stands.**

This packet originally asserted that `viteEnv()`'s cast
(`(import.meta as unknown as {...}).env`) defeats Vite's static substitution.
**That premise is FALSE.** Independent QA reproduced it on Vite `8.0.3` /
rolldown / Node `v24.14.1`:

| Build | Var | `dev-jegs` in emitted bundle |
| --- | --- | --- |
| base `b7ee67d4` | **set** | **2** — substitution works *through* the cast |
| base `b7ee67d4` | absent | **0** |
| fix `0a06f306` | set | 2 |
| fix `0a06f306` | absent (production) | guard fails, no bundle emitted |

The base-with-var minified output contains
`...VITE_ENROLLPRO_URL:"https://dev-jegs.buru-degree.ts.net",...` reached through the
cast path. **The sole reproducible root cause is the missing build-time value.**

R1 (statically analyzable access) is therefore retained on its own merits —
robustness and explicitness: it narrows the inlined environment to two named keys
instead of the whole env object, so a future bundler or config change cannot silently
regress it. It is **not** justified by the false premise, and the record now says so.

**Also resolved (not a defect):** a QA note reported runtime identity drift
(`cli.mjs status` showing `f0d65a53` / `stopped`). That was a **false alarm** — there
is one `supervisor-state.json` per release directory, and only the one inside the
**active** `ATLAS_RUNTIME_SOURCE_DIR` is authoritative. Verified 2026-09-18: machine
env, both listeners (PIDs 63688 / 12992) and the active state file all report
`74c1f12a5c06`, `state: running`. The `f0d65a53` file is a stale artifact from the
previous release.

## 1. Required outcomes

**R1 — Statically analyzable env access.**
Read `import.meta.env.VITE_ENROLLPRO_URL` (and `VITE_ENROLLPRO_SSO_START_URL`)
through a form Vite can statically replace, so the value is inlined at build time.
Keep the Node-test fallback (the module is also imported under `tsx`/`node --test`,
where `import.meta.env` is undefined) — do not break the existing
`companion-config.test.ts` / `companion-sso-client.test.ts` contract.

**R2 — Fail-closed build guard.**
A production build with a missing or blank `VITE_ENROLLPRO_URL` must **fail the
build** with a clear message, rather than silently shipping a bundle in which every
companion surface is dead. This matches the module's own stated doctrine
("when unset or blank the resolvers return null and the consuming surface must
disable or omit the link"). The guard must be satisfied by the normal build entry
point, and must not break the Node test runner or a development build.

**R3 — Provide the value at build time.**
Wire the build so `VITE_ENROLLPRO_URL` is present. The correct EnrollPro origin for
this environment is `https://dev-jegs.buru-degree.ts.net` (see the directive's
companion-browser rule). This is a **URL, not a secret** — do not introduce any
secret into a client-visible variable. Use the existing `.env.example` pattern and
whatever production env mechanism the repo already uses; do not invent a new one.

**R4 — Prove the server side is live.**
The four keys are already loaded. Verify, read-only against the running runtime:
the SSO routes are mounted; the reverse exchange no longer returns
`COMPANION_SSO_CLIENT_INVALID` against a correctly paired bearer; and a **mutated**
bearer is rejected **without consuming a code**. Do not consume a real code.

**R5 — The app shell must reflect configuration truthfully.**
When configured, the Integrated Systems area renders the companion entry with a
working reverse-SSO start link. When not configured, it renders an explicit
disabled state that says why — never a dead or misleading control.

## 2. Production-path proof required

| # | Requirement | Negative control |
| --- | --- | --- |
| 1 | The built bundle contains the configured EnrollPro origin | Build with the var absent; assert the guard fails the build (failing-first) |
| 2 | The bundle contains the reverse-start URL | Assert the full URL, not just the path |
| 3 | Resolver returns the origin | Unit test with the var set; and with it unset returns `null` (existing contract preserved) |
| 4 | Node test runner unaffected | `companion-config.test.ts` and `companion-sso-client.test.ts` still pass |
| 5 | Shell states | Rendered check of configured vs unconfigured states |
| 6 | Server side | Routes mounted; paired bearer accepted; mutated bearer rejected with zero code consumption |

Evidence must come from the **real build output**, not a hand-written fixture. A
bundle scan is the decisive check: `dev-jegs` occurrences must be **> 0** after the
fix (they are 0 today).

## 3. Forbidden

- No rebuild or redeploy of the release (separate `HIGH` action).
- No edit to `D:\ATLAS-runtime-config\atlas-server.env`, the supervisor task, or
  ports 5001/5174.
- No secret in any client-visible variable; no credential printed, staged, or logged.
- No companion repository edits. SMART/EnrollPro/AIMS are `READ_ONLY`.
- Do not edit `docs/plans/live-state.md`, the machine register, or `CHANGELOG.md`.
- Do not touch `test:ux-guardrails` or `package.json` test wiring (separately
  registered defect: that script names two files that do not exist and exits 0 while
  covering nothing).

## 4. Return contract

Commit the bounded candidate and return `REVIEW_REQUIRED` with: base SHA,
candidate SHA, exact changed paths, the requirement -> production path -> negative
control -> result table, the captured failing-first evidence, the **bundle scan
before/after** counts, and any `BLOCKED`/`DEFERRED` row named explicitly.
Executors do not self-accept, merge, or push.

## 5. Browser evidence

The Integrated Systems area is a rendered surface. Live Tailnet evidence against
`https://njgrm.buru-degree.ts.net` with a `window.location.origin` assertion is
required for the rendered configured/unconfigured states. Do not complete a real
cross-system login; the end-to-end EnrollPro↔ATLAS session is a separate joint
session. A login creates a `LOCAL_LOGIN_SUCCESS` audit row — disclose the delta
before performing one.
