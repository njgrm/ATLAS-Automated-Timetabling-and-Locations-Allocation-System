# EnrollPro companion unreachable — `dev-jegs` offline (2026-09-20)

**To:** the EnrollPro owner/operator · **From:** ATLAS primary planner
**Severity:** demo-visible in ATLAS, **not an ATLAS defect** · **Status:** OPEN, external

## Symptom

The live ATLAS host serves the EnrollPro proxy routes, but every one currently
returns 502:

- `GET https://njgrm.buru-degree.ts.net/enrollpro-api/settings/public`
  → `502 {"code":"UPSTREAM_UNREACHABLE","message":"connect ETIMEDOUT 100.120.169.123:443"}`

User-visible consequence inside ATLAS: surfaces that read **live** EnrollPro data
(public settings, uploaded images under `/enrollpro-uploads/*`) fail in the browser
console, while the rest of the application degrades gracefully and continues to use
its saved/mirrored data.

## Evidence (read-only, 2026-09-20 ~12:20 +08)

- `tailscale status` → `100.120.169.123  dev-jegs  …  windows  active; relay "hkg"; offline, last seen 10h ago, tx 4056 rx 0`
- `Test-NetConnection 100.120.169.123 -Port 443` → `TcpTestSucceeded=False`, `PingSucceeded=False`
- Direct `https://dev-jegs.buru-degree.ts.net/api/integration/v1/health` and
  `…/api/settings/public` → "Unable to connect to the remote server"
- Control: ATLAS's own tailnet origin is healthy (`/api/v1/health` 200), so the
  ATLAS node's Tailscale connectivity and Serve configuration are not the cause.

## The ATLAS side is already correct — no ATLAS change is required

- The deployed release `7499916886707c35ea708a17ef7a87e791a6bade` consumes the
  durable origin: the supervisor resolves `ENROLLPRO_PROXY_ORIGIN` in
  `ops/runtime/lib/enrollpro-origin.mjs` and `ops/runtime/cli.mjs`.
- The durable env file `D:\ATLAS-runtime-config\atlas-server.env` already declares
  the `ENROLLPRO_PROXY_ORIGIN` key (key names observed; no value is read into any
  ATLAS artifact).
- The proxy's `UPSTREAM_UNREACHABLE` response is the correct fail-closed signal for
  an unreachable upstream; it is not a contract or configuration error.

Consequence for ATLAS planning: the prepared packet
`docs/prompts/enrollpro-proxy-recovery-live-2026-09-14.md` is **SUPERSEDED and must
not be executed**. Its env premise (key absent) is false, and its release binding
would downgrade the live runtime.

## Required action (companion side)

1. Bring the `dev-jegs` node online on the tailnet, and confirm
   `https://dev-jegs.buru-degree.ts.net/api/integration/v1/health` returns 200.
2. Confirm the EnrollPro routes ATLAS proxies to are served by that host
   (`/api/settings/public` and the uploads path).
3. No ATLAS patch is proposed. This is an availability problem on the companion
   node, not a defect in the EnrollPro contract, so nothing here is a code change.

ATLAS needs no action once the peer is online; the operator can confirm recovery
with the two proxy URLs at the top of this file.
