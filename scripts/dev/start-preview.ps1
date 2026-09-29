# Starts an atlas-client vite preview fully detached, so a planner's shell call returns.
# Start-Process in any form keeps an opencode shell call open on Windows (2026-09-29); Win32_Process Create does not.
# The preview always proxies to STAGING (AGENTS.md section 5). Usage:
#   powershell -File scripts/dev/start-preview.ps1 -ClientDir <worktree>\atlas-client -Port 5230
param([Parameter(Mandatory)][string]$ClientDir, [Parameter(Mandatory)][int]$Port)
$out = Join-Path $env:TEMP "atlas-preview-$Port.log"
# A6 c8 (2026-09-29): `VITE_ATLAS_API` is the axios BASE URL (`atlas-client/src/lib/api.ts`:
# `runtimeEnv?.VITE_ATLAS_API ?? '/api/v1'`), not just a proxy target, so it must carry the
# `/api/v1` prefix. Without it every request went to `<staging>/auth/login` and came back 404,
# which read as "login is broken" rather than "the base is wrong".
#
# A9 c4 (2026-09-29, `aa2dcfdf`) landed the SAME fix independently and reached the same
# `/api/v1` value; the merge on 2026-09-29 took this side because it carries the reasoning,
# and the two are behaviourally identical.
#
# The ORIGIN here is still what keeps a loopback preview off live: `vite.config.ts`
# `toProxyOrigin()` takes `.origin` for the `/api` proxy target, so the proxy also points at
# staging and never at the live 5001. Never drop the port or point this at 5001 (AGENTS.md section 5).
# A4 train 9 (2026-09-29): a busy port answered 200 from ANOTHER lane's preview, so this reported READY while its own
# vite had exited with "Port already in use". Refuse a busy port up front and require vite's own ready line in the log.
# Staging CORS allows only 5200-5299 (atlas-staging.env CORS_EXTRA_ORIGINS); a port outside it signs in, then every API call is CORS-blocked (A6 c10, 2026-09-29).
if ($Port -lt 5200 -or $Port -gt 5299) { "PORT_OUT_OF_RANGE $Port: staging CORS allows only 5200-5299; pick a free port there"; exit 3 }
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) { "PORT_BUSY $Port is already in use by another preview; pick a free port in 5200-5299"; exit 2 }
$apiBase = "http://127.0.0.1:5101/api/v1"
$cl = "cmd /c `"cd /d $ClientDir && set VITE_ATLAS_API=$apiBase&& node node_modules/vite/bin/vite.js --port $Port --strictPort --host 127.0.0.1 > $out 2>&1`""
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cl }
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
  try { if ((Select-String -Path $out -Pattern 'ready in|Local:' -Quiet -ErrorAction SilentlyContinue) -and (Invoke-WebRequest "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { "READY http://127.0.0.1:$Port pid $($r.ProcessId) log $out"; exit 0 } } catch {}
  Start-Sleep -Seconds 2
}
"NOT_READY after 60 s; see $out"; exit 1
