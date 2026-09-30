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
$H = if ($env:LANE_C_HOME) { $env:LANE_C_HOME } else { 'D:\ATLAS-lane-c' }
$snapshot = Join-Path $H 'manager-repo'
function Sync-ManagerSnapshot {
  New-Item -ItemType Directory -Force $snapshot | Out-Null
  New-Item -ItemType Directory -Force (Join-Path $snapshot 'ops') | Out-Null
  foreach ($f in 'AGENTS.md', 'DESIGN.md', 'PRODUCT.md') {
    Copy-Item -LiteralPath (Join-Path $repo $f) -Destination (Join-Path $snapshot $f) -Force
  }
  foreach ($d in 'ops\lane-c', 'ops\runtime\release') {
    Copy-Item -LiteralPath (Join-Path $repo $d) -Destination (Join-Path $snapshot $d) -Recurse -Force
  }
  foreach ($f in 'docs\plans\live-state.md', 'docs\plans\operator-decisions.md', 'docs\handoffs\workflow-metrics.md') {
    $destination = Join-Path $snapshot $f
    New-Item -ItemType Directory -Force (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath (Join-Path $repo $f) -Destination $destination -Force
  }
}
function Assert-CleanTickRepo {
  if (@(git -C $repo status --short).Count) {
    & (Join-Path $repo 'ops/lane-c/codex/notify.ps1') -Text "Lane C manager stopped: manager worktree is dirty."
    throw "TICK_REPO_DIRTY:$repo"
  }
}
function Assert-TickRepoUnchanged {
  param([string]$Head)
  $currentHead = (git -C $repo rev-parse HEAD).Trim()
  $changed = @(git -C $repo status --short)
  if ($currentHead -ne $Head -or $changed.Count) {
    & (Join-Path $repo 'ops/lane-c/codex/notify.ps1') -Text "Lane C manager stopped: a tick changed its repository worktree."
    throw "TICK_REPO_CHANGED:$repo"
  }
}
function Process-DispatchRequest {
  $requestPath = Join-Path $H 'dispatch-request.json'
  if (-not (Test-Path -LiteralPath $requestPath)) { return }
  try { $request = Get-Content -LiteralPath $requestPath -Raw | ConvertFrom-Json } catch { throw "INVALID_DISPATCH_REQUEST:$($_.Exception.Message)" }
  foreach ($property in 'name', 'packet', 'agent', 'dir') {
    if (-not $request.$property) { throw "INVALID_DISPATCH_REQUEST:missing_$property" }
  }
  if ($request.name -notmatch '^[a-z0-9][a-z0-9-]{0,63}$' -or $request.packet -notmatch '^docs/prompts/v2/[a-z0-9][a-z0-9-]{0,63}\\.md$') {
    throw 'INVALID_DISPATCH_REQUEST:name_or_packet'
  }
  if ($request.agent -notin @('atlas-planner', 'atlas-executor', 'atlas-qa', 'atlas-wave-auditor')) { throw 'INVALID_DISPATCH_REQUEST:agent' }
  $dir = (Resolve-Path -LiteralPath $request.dir -ErrorAction Stop).Path
  if ($dir -notlike 'E:\ATLAS-worktrees\*' -or -not (Test-Path -LiteralPath (Join-Path $dir $request.packet))) {
    throw 'INVALID_DISPATCH_REQUEST:unpinned_or_missing_packet'
  }
  & (Join-Path $repo 'ops/lane-c/launch.ps1') -Name $request.name -Agent $request.agent -Dir $dir -Prompt "Read $($request.packet) and execute it. End with the report block."
  Move-Item -LiteralPath $requestPath -Destination (Join-Path $H "dispatch-processed-$($request.name)-$(Get-Date -Format yyyyMMdd-HHmmss).json")
}
Assert-CleanTickRepo
$ticks = Join-Path $H 'manager-ticks'; New-Item -ItemType Directory -Force $ticks | Out-Null
foreach ($f in 'manager-state.md', 'operator-inbox.md', 'manager-outbox.md') {
  $p = Join-Path $H $f; if (-not (Test-Path $p)) { New-Item -ItemType File $p | Out-Null }
}
$bash = 'C:\Program Files\Git\bin\bash.exe'
$lastDigest = ''; $lastTick = [datetime]::MinValue

while ($true) {
  git -C $repo fetch -q origin 2>$null
  # Keep the tick's own rules current: fast-forward the (clean) manager worktree to origin/main every loop.
  # Without this each tick read a stale MANAGER.md/PLANNERS.md/status.sh (Lane C, 2026-09-30 21:20).
  Assert-CleanTickRepo
  git -C $repo merge -q --ff-only origin/main 2>$null
  if ($LASTEXITCODE -ne 0) { & (Join-Path $repo 'ops/lane-c/codex/notify.ps1') -Text 'Lane C manager: worktree cannot fast-forward to main.'; throw 'TICK_REPO_NOT_FF' }
  Sync-ManagerSnapshot
  $status =& $bash (Join-Path $repo 'ops/lane-c/status.sh') 2>&1 | Out-String
  # Digest ignores idle-minute counters so a tick fires on real change only.
  $runs = ($status -split "`n" | Where-Object { $_ -match '^\S+\s+(RUNNING|EXITED|DIED-EMPTY)' } |
           ForEach-Object { ($_ -split '\s+')[0..1] -join ' ' }) -join ';'
  $health = ($status -split "`n" | Where-Object { $_ -match 'health|live data' }) -join ';'
  $branches = ($status -split "`n" | Where-Object { $_ -match '^\s+\d\d:\d\d origin/' }) -join ';'
  $posts = git -C $repo log -1 --format=%H origin/main -- docs/handoffs 2>$null
  $inboxItem = Get-Item -LiteralPath (Join-Path $H 'operator-inbox.md')
  $inbox = "$($inboxItem.Length):$($inboxItem.LastWriteTimeUtc.Ticks)"
  $codexDone = (Get-ChildItem (Join-Path $H 'codex-qa') -Recurse -Filter final.md -EA SilentlyContinue |
                ForEach-Object { $_.FullName + $_.LastWriteTime.Ticks }) -join ';'
  $digest = "$runs|$health|$branches|$posts|$inbox|$codexDone"

  $due = ((Get-Date) - $lastTick).TotalMinutes -ge $HeartbeatMinutes
  if ($digest -ne $lastDigest -or $due) {
    Assert-CleanTickRepo
    $stamp = Get-Date -Format 'yyyyMMdd-HHmm'
    $why = if ($digest -ne $lastDigest) { 'change' } else { 'heartbeat' }
    $tickHead = (git -C $repo rev-parse HEAD).Trim()
    $prompt = @"
The repository mirror is read-only at $snapshot. Read $snapshot/ops/lane-c/codex/MANAGER.md and follow it. A tick may write ONLY
under $H; it must not edit, commit, merge, push, revert, remove, or create files in the real repository or any worktree.
Tick reason: $why at $(Get-Date -Format 'yyyy-MM-dd HH:mm').
Events (status.sh output):
$status
"@
    $env:CODEX_HOME = $ManagerHome
    $env:ATLAS_MANAGER_REPO = $snapshot
    # The manager account's native Windows sandbox rejects all shell reads, including its external mirror.
    # Keep its session rooted away from the real checkout; the before/after Git tripwire below stops on any real-tree write.
    $prompt | codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C $H -m $Model `
      -c "model_reasoning_effort=$Effort" -o (Join-Path $ticks "$stamp.md") - *> (Join-Path $ticks "$stamp.log")
    Remove-Item Env:CODEX_HOME
    Remove-Item Env:ATLAS_MANAGER_REPO
    Assert-TickRepoUnchanged -Head $tickHead
    Process-DispatchRequest
    Write-Host "$(Get-Date -Format HH:mm) tick ($why): $(Get-Content (Join-Path $ticks "$stamp.md") -Tail 1 -EA SilentlyContinue)"
    $lastTick = Get-Date
    $lastDigest = $digest  # recompute next loop; changes made by the tick itself trigger at most one follow-up tick
  }
  Start-Sleep -Seconds ($Minutes * 60)
}
