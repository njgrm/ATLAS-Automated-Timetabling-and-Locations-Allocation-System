# Lane C manager loop: every -Minutes, compute an event digest; when it changed (or every -HeartbeatMinutes), run one
# stateless Codex manager tick on the MANAGER account (its own CODEX_HOME). It must run from a clean registered worktree.
param(
  [string]$ManagerHome = 'D:\codex-homes\manager',
  [string]$Repo = 'D:\ATLAS',
  [int]$Minutes = 5,
  [int]$HeartbeatMinutes = 60,
  [string]$Model = 'gpt-5.6-terra',
  [string]$Effort = 'medium'
)
$ErrorActionPreference = 'Continue'
$repo = (Resolve-Path -LiteralPath $Repo -ErrorAction Stop).Path
git -C $repo rev-parse --is-inside-work-tree | Out-Null
if ($LASTEXITCODE -ne 0) { throw "TICK_REPO_NOT_GIT:$repo" }
if (@(git -C $repo status --short).Count) { throw "TICK_REPO_DIRTY:$repo" }
$H = if ($env:LANE_C_HOME) { $env:LANE_C_HOME } else { 'D:\ATLAS-lane-c' }
$ticks = Join-Path $H 'manager-ticks'; New-Item -ItemType Directory -Force $ticks | Out-Null
foreach ($f in 'manager-state.md', 'operator-inbox.md', 'manager-outbox.md') {
  $p = Join-Path $H $f; if (-not (Test-Path $p)) { New-Item -ItemType File $p | Out-Null }
}
$bash = 'C:\Program Files\Git\bin\bash.exe'
$env:LANE_C_TICK_REPO = $repo
$lastDigest = ''; $lastTick = [datetime]::MinValue

while ($true) {
  git -C $repo fetch -q origin 2>$null
  $status = & $bash -lc 'bash "$(cygpath -u "$LANE_C_TICK_REPO")/ops/lane-c/status.sh"' 2>&1 | Out-String
  # Digest ignores idle-minute counters so a tick fires on real change only.
  $runs = ($status -split "`n" | Where-Object { $_ -match '^\S+\s+(RUNNING|EXITED|DIED-EMPTY)' } |
           ForEach-Object { ($_ -split '\s+')[0..1] -join ' ' }) -join ';'
  $health = ($status -split "`n" | Where-Object { $_ -match 'health|:4097 busy|live data' }) -join ';'
  $branches = ($status -split "`n" | Where-Object { $_ -match '^\s+\d\d:\d\d origin/' }) -join ';'
  $posts = git -C $repo log -1 --format=%H origin/main -- docs/handoffs 2>$null
  $inbox = (Get-FileHash (Join-Path $H 'operator-inbox.md')).Hash
  $codexDone = (Get-ChildItem (Join-Path $H 'codex-qa') -Recurse -Filter final.md -EA SilentlyContinue |
                ForEach-Object { $_.FullName + $_.LastWriteTime.Ticks }) -join ';'
  $digest = "$runs|$health|$branches|$posts|$inbox|$codexDone"

  $due = ((Get-Date) - $lastTick).TotalMinutes -ge $HeartbeatMinutes
  if ($digest -ne $lastDigest -or $due) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmm'
    $why = if ($digest -ne $lastDigest) { 'change' } else { 'heartbeat' }
    $prompt = @"
Read ops/lane-c/codex/MANAGER.md and follow it. Tick reason: $why at $(Get-Date -Format 'yyyy-MM-dd HH:mm').
Events (status.sh output):
$status
"@
    $env:CODEX_HOME = $ManagerHome
    $prompt | codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C $repo -m $Model `
      -c "model_reasoning_effort=$Effort" -o (Join-Path $ticks "$stamp.md") - *> (Join-Path $ticks "$stamp.log")
    Remove-Item Env:CODEX_HOME
    Write-Host "$(Get-Date -Format HH:mm) tick ($why): $(Get-Content (Join-Path $ticks "$stamp.md") -Tail 1 -EA SilentlyContinue)"
    $lastTick = Get-Date
    $lastDigest = $digest  # recompute next loop; changes made by the tick itself trigger at most one follow-up tick
  }
  Start-Sleep -Seconds ($Minutes * 60)
}
