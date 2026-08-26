# ATLAS Client Exposure via Tailscale

This guide exposes the ATLAS client (`atlas-client`, Vite on port `5174`) so EnrollPro developers can access it remotely.

## What Is Already Done (Confirmed)

Based on current project docs:
- ATLAS API is already reachable on Tailscale at port `5001`.
- PostgreSQL is already reachable on Tailscale at port `5432`.
- A direct client URL over tailnet IP is already documented.

Reference: `ATLAS-PUBLIC-API.md` -> `Connectivity (Tailscale)`.

## Recommended Access Mode

Use `tailscale serve` for private tailnet-only access.

Use `tailscale funnel` only when you intentionally need internet-public access.

## Prerequisites

1. Tailscale installed and connected on the host machine running ATLAS.
2. Tailscale installed and connected on the EnrollPro programmer machine.
3. Both users in the same tailnet (for `serve`).
4. ATLAS client running on the host machine.

## Step 1: Start the ATLAS Client

From project root:

```powershell
npm --prefix atlas-client run dev
```

The client is configured to bind externally already (`host: true`) in `atlas-client/vite.config.ts`.

## Step 2A: Private Tailnet Access (Preferred)

Expose local client to tailnet via Tailscale Serve:

```powershell
tailscale serve --bg 5174
```

Alternative explicit target form:

```powershell
tailscale serve --bg http://127.0.0.1:5174
```

Check status:

```powershell
tailscale serve status
```

Then share the generated `https://<machine>.<tailnet>.ts.net` URL with EnrollPro developers.

## Step 2B: Public Internet Access (Only If Needed)

If EnrollPro developer is not on your tailnet and your admin policy allows it:

```powershell
tailscale funnel --bg 5174
```

Check status:

```powershell
tailscale funnel status
```

Important:
- Funnel exposes service to the public internet.
- Use only temporarily and disable when finished.

Disable Funnel:

```powershell
tailscale funnel reset
```

## Step 3: Connectivity Validation

On host machine:

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 5174
```

On EnrollPro programmer machine (tailnet mode):
- Open the shared `https://<machine>.<tailnet>.ts.net` URL.

If using direct tailnet IP mode (already documented):
- `http://<host-tailscale-ip>:5174`

## Operational Commands

Show node + tailnet IP:

```powershell
tailscale ip -4
```

Show all Serve/Funnel mappings:

```powershell
tailscale serve status
tailscale funnel status
```

Clear Serve mapping:

```powershell
tailscale serve reset
```

## Troubleshooting

1. `tailscale serve status` shows no handler:
   - Re-run `tailscale serve --bg 5174`.

2. URL opens but app fails API calls:
   - Confirm ATLAS server is running at `http://localhost:5001` on host.
   - Confirm client proxy env values if overridden (`VITE_ATLAS_API`, `VITE_ENROLLPRO_API_BASE`).

3. `funnel` command denied:
   - Tailnet admin may not allow Funnel for your node/account.
   - Use `serve` instead.

4. EnrollPro cannot access in tailnet mode:
   - Ensure both users are logged into the same tailnet.
   - Verify ACL allows access to your node.

## Quick Start (Copy/Paste)

```powershell
npm --prefix atlas-client run dev
tailscale serve --bg 5174
tailscale serve status
```

Share resulting HTTPS Tailscale URL with the EnrollPro programmer.
