# Step 3 of a release (ELEVATED). Run only by the "ATLAS Release" scheduled task, every minute, from its installed
# copy in C:\ProgramData\ATLAS\release\bin (admin-only). It never builds and never runs agent code: it validates
# one request, runs the pinned deploy-runner.ps1 (dry run, then execute), proves the new release is serving, and
# rolls back to the incumbent automatically if that proof fails. Writes results\<id>.json; logs to logs\<id>.log.
$ErrorActionPreference = 'Stop'
$box = 'C:\ProgramData\ATLAS\release'
$req = "$box\inbox\request.json"
if (-not (Test-Path $req)) { exit 0 }
$lock = "$box\inbox\.lock"
if (Test-Path $lock) { if (((Get-Date) - (Get-Item $lock).LastWriteTime).TotalMinutes -lt 30) { exit 0 } }
Set-Content $lock $PID
$r = Get-Content $req -Raw | ConvertFrom-Json
Move-Item $req "$box\inbox\processing-$($r.id).json" -Force
$log = "$box\logs\$($r.id).log"
$steps = [System.Collections.Generic.List[object]]::new()
function Note([string]$s) { $line = "$(Get-Date -Format HH:mm:ss) $s"; Add-Content $log $line; $steps.Add($line) }
function Finish([string]$status, [string]$detail) {
  Note "$status $detail"
  [pscustomobject]@{ id = $r.id; mode = $r.mode; sha = $r.sha; incumbentSha = $r.incumbentSha; status = $status; detail = $detail; finishedAt = (Get-Date).ToString('o'); steps = $steps; log = $log } |
    ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 "$box\results\$($r.id).json"
  Remove-Item $lock -Force -EA SilentlyContinue
  exit 0
}
# SYSTEM reads a user-owned repo: allow it for the git calls in this process tree only.
$env:GIT_CONFIG_COUNT = '1'; $env:GIT_CONFIG_KEY_0 = 'safe.directory'; $env:GIT_CONFIG_VALUE_0 = '*'
$runner = "$box\bin\deploy-runner.ps1"
$envFile = 'D:\ATLAS-runtime-config\atlas-server.env'   # path only; never read here

# --- validate the request (fail closed) ---
if ($r.sha -notmatch '^[0-9a-f]{40}$') { Finish 'REFUSED' 'bad sha' }
if ($r.dir -notlike 'E:\ATLAS-worktrees\lane-a4-release-*' -or -not (Test-Path $r.dir)) { Finish 'REFUSED' "bad dir $($r.dir)" }
if (((Get-Date) - [datetime]$r.requestedAt).TotalMinutes -gt 20) { Finish 'REFUSED' 'request older than 20 min' }
$incumbent = [Environment]::GetEnvironmentVariable('ATLAS_RUNTIME_RELEASE_SHA', 'Machine')
$incumbentDir = [Environment]::GetEnvironmentVariable('ATLAS_RUNTIME_SOURCE_DIR', 'Machine')
if ($incumbent -ne $r.incumbentSha) { Finish 'REFUSED' "live moved since the request ($incumbent)" }
if ($r.sha -eq $incumbent) { Finish 'REFUSED' 'target is already live' }
if ((git -C $r.dir rev-parse HEAD).Trim() -ne $r.sha) { Finish 'REFUSED' 'tree is not at the requested sha' }
foreach ($f in 'atlas-server\dist\server.js', 'atlas-client\dist\index.html') { if (-not (Test-Path (Join-Path $r.dir $f))) { Finish 'REFUSED' "missing $f" } }
git -C D:\ATLAS fetch -q origin 2>&1 | Out-Null
git -C D:\ATLAS merge-base --is-ancestor $r.sha origin/main
if ($LASTEXITCODE -ne 0) { Finish 'REFUSED' 'sha not on origin/main' }
Note "validated $($r.sha.Substring(0,8)) over $($incumbent.Substring(0,8)) ($incumbentDir)"

function Invoke-Runner([string]$tSha, [string]$tDir, [string]$iSha, [string]$iDir, [switch]$Execute) {
  $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runner, '-TargetSha', $tSha, '-TargetSourceDir', $tDir, '-IncumbentSha', $iSha, '-IncumbentSourceDir', $iDir, '-EnvFile', $envFile)
  if ($Execute) { $a += '-Execute' }
  $out = & powershell.exe @a 2>&1 | Out-String
  Add-Content $log $out
  return $LASTEXITCODE
}
function Test-Serving([string]$dir, [int]$budgetSec = 180) {
  $until = (Get-Date).AddSeconds($budgetSec)
  while ((Get-Date) -lt $until) {
    Start-Sleep -Seconds 5
    try {
      $ready = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 'http://127.0.0.1:5001/api/v1/health/ready').StatusCode
      $client = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 'http://127.0.0.1:5174/').StatusCode
      $pid5001 = (Get-NetTCPConnection -State Listen -LocalPort 5001 -EA Stop | Select-Object -First 1).OwningProcess
      $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$pid5001").CommandLine
      if ($ready -eq 200 -and $client -eq 200 -and $cmd -like "*$dir*") { return $true }
    } catch { }
  }
  return $false
}

# --- dry run, then cut over ---
if ((Invoke-Runner $r.sha $r.dir $incumbent $incumbentDir) -ne 0) { Finish 'FAILED_BEFORE_CUTOVER' 'deploy-runner dry run refused (see log; usually live-state.md gate)' }
if ($r.mode -eq 'dry-run') { Finish 'DRY_RUN_OK' 'plan written; nothing changed' }
Note 'cutover start'
if ((Invoke-Runner $r.sha $r.dir $incumbent $incumbentDir -Execute) -ne 0) {
  if (Test-Serving $incumbentDir 60) { Finish 'FAILED_RESTORED' 'cutover failed; deploy-runner restored the incumbent' }
  Finish 'FAILED_DOWN' 'cutover failed and the incumbent is not serving: operator attention'
}
if (Test-Serving $r.dir) { Finish 'LIVE' "serving from $($r.dir)" }

# --- automatic rollback ---
Note 'new release not serving within 180 s: rolling back'
if ((Invoke-Runner $incumbent $incumbentDir $r.sha $r.dir -Execute) -eq 0 -and (Test-Serving $incumbentDir)) { Finish 'ROLLED_BACK' "restored $($incumbent.Substring(0,8))" }
Finish 'FAILED_DOWN' 'rollback did not restore service: operator attention'
