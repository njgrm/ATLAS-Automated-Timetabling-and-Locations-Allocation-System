# Starts an atlas-client vite preview fully detached, so a planner's shell call returns.
# Start-Process in any form keeps an opencode shell call open on Windows (2026-09-29); Win32_Process Create does not.
# The preview always proxies to STAGING (AGENTS.md section 5). Usage:
#   powershell -File scripts/dev/start-preview.ps1 -ClientDir <worktree>\atlas-client -Port 5399
param([Parameter(Mandatory)][string]$ClientDir, [Parameter(Mandatory)][int]$Port)
$out = Join-Path $env:TEMP "atlas-preview-$Port.log"
# The `/api/v1` SUFFIX IS REQUIRED, and losing it is silent: `atlas-client/src/lib/api.ts`
# builds its base URL as `import.meta.env.VITE_ATLAS_API ?? '/api/v1'`, so this variable is an
# API BASE, not an origin. With a bare origin the client asks `http://127.0.0.1:5101/auth/login`
# and staging answers 404, so the preview loads and then cannot sign in (A3-C14, 2026-09-29).
# The vite PROXY is unaffected either way, because `toProxyOrigin` in vite.config.ts keeps only
# the parsed origin.
$cl = "cmd /c `"cd /d $ClientDir && set VITE_ATLAS_API=http://127.0.0.1:5101/api/v1&& node node_modules/vite/bin/vite.js --port $Port --strictPort --host 127.0.0.1 > $out 2>&1`""
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cl }
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
  try { if ((Invoke-WebRequest "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { "READY http://127.0.0.1:$Port pid $($r.ProcessId) log $out"; exit 0 } } catch {}
  Start-Sleep -Seconds 2
}
"NOT_READY after 60 s; see $out"; exit 1
