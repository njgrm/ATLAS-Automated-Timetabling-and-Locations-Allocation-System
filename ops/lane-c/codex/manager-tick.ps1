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
$stateCandidate = [IO.Path]::GetFullPath($H).Replace('\','/').TrimEnd('/').ToLowerInvariant()
$registeredCandidates = @(git -C $repo worktree list --porcelain | Where-Object { $_ -like 'worktree *' } |
  ForEach-Object { [IO.Path]::GetFullPath($_.Substring(9)).Replace('\','/').TrimEnd('/').ToLowerInvariant() })
foreach ($treePath in $registeredCandidates) {
  if ($stateCandidate -eq $treePath -or $stateCandidate.StartsWith("$treePath/")) { throw "INVALID_LANE_C_HOME_INSIDE_WORKTREE:$H" }
}
New-Item -ItemType Directory -Force $H | Out-Null
$H = (Resolve-Path -LiteralPath $H -ErrorAction Stop).Path
$snapshot = Join-Path $H 'manager-repo'
function Normalize-Path([string]$Path) { (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path.Replace('\','/').TrimEnd('/').ToLowerInvariant() }
function Get-RegisteredWorktrees {
  @(git -C $repo worktree list --porcelain | Where-Object { $_ -like 'worktree *' } |
    ForEach-Object { $_.Substring(9) })
}
function Assert-ExternalStateRoot {
  $statePath = Normalize-Path $H
  foreach ($tree in Get-RegisteredWorktrees) {
    $treePath = Normalize-Path $tree
    if ($statePath -eq $treePath -or $statePath.StartsWith("$treePath/")) { throw "INVALID_LANE_C_HOME_INSIDE_WORKTREE:$H" }
  }
}
function Get-WorktreeFingerprints {
  $rows = foreach ($tree in Get-RegisteredWorktrees) {
    $treePath = Normalize-Path $tree
    $head = (git -C $tree rev-parse HEAD).Trim()
    $status = (git -C $tree status --porcelain) -join "`n"
    "$treePath|$head|$status"
  }
  $rows | Sort-Object
}
function Assert-WorktreesUnchanged {
  param([string[]]$Before)
  $after = Get-WorktreeFingerprints
  if ((Compare-Object -ReferenceObject $Before -DifferenceObject $after)) {
    & (Join-Path $snapshot 'ops/lane-c/codex/notify.ps1') -Text 'Lane C manager stopped: a tick changed a registered worktree.'
    throw 'TICK_WORKTREE_CHANGED'
  }
}
function Sync-ManagerSnapshot {
  New-Item -ItemType Directory -Force $snapshot | Out-Null
  $files = @(
    'AGENTS.md', 'DESIGN.md', 'PRODUCT.md', 'ops/lane-c/README.md', 'ops/lane-c/status.sh',
    'ops/lane-c/codex/MANAGER.md', 'ops/lane-c/codex/PLANNERS.md', 'ops/lane-c/codex/notify.ps1',
    'ops/runtime/release/README.md', 'docs/plans/live-state.md', 'docs/plans/operator-decisions.md',
    'docs/handoffs/workflow-metrics.md'
  )
  foreach ($f in $files) {
    $destination = Join-Path $snapshot $f
    New-Item -ItemType Directory -Force (Split-Path -Parent $destination) | Out-Null
    # Byte-exact copy: PowerShell 5.1 Set-Content -Encoding utf8 added a BOM and CRLF, which broke status.sh in the
    # mirror all night (2026-09-30/10-01); the manager then reported the repo file as the blocker.
    & cmd.exe /c "git -C `"$repo`" show `"origin/main:$f`" > `"$destination`""
    if ($LASTEXITCODE -ne 0) { throw "MIRROR_SOURCE_MISSING:$f" }
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
    $summary = @(
      "HEAD before: $Head", "HEAD after: $currentHead", 'status:', $changed,
      'unstaged diff stat:', (git -C $repo diff --stat),
      'staged diff stat:', (git -C $repo diff --cached --stat)
    ) -join "`n"
    Add-Content -LiteralPath (Join-Path $H 'manager-outbox.md') -Value ("`n## Tick stopped " + (Get-Date -Format 'yyyy-MM-dd HH:mm') + "`n$summary`n")
    & (Join-Path $snapshot 'ops/lane-c/codex/notify.ps1') -Text "Lane C manager stopped: a tick changed its repository worktree."
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
  if ($dir -notlike 'E:\ATLAS-worktrees\*') { throw 'INVALID_DISPATCH_REQUEST:unpinned_worktree' }
  $head = (git -C $dir rev-parse HEAD).Trim()
  $main = (git -C $repo rev-parse origin/main).Trim()
  $clean = @(git -C $dir status --short).Count -eq 0
  git -C $repo cat-file -e "origin/main:$($request.packet)" 2>$null
  if (-not $clean -or $head -ne $main -or $LASTEXITCODE -ne 0 -or
      -not (Test-Path -LiteralPath (Join-Path $dir $request.packet))) {
    throw 'INVALID_DISPATCH_REQUEST:unpinned_or_missing_packet'
  }
  $launchResult = & (Join-Path $repo 'ops/lane-c/launch.ps1') -Name $request.name -Agent $request.agent -Dir $dir -Prompt "Read $($request.packet) and execute it. End with the report block."
  if ($launchResult -notmatch "^$($request.name) PID \d+ log " -or -not (Test-Path -LiteralPath (Join-Path $H "runs\$($request.name).pid"))) {
    throw 'DISPATCH_LAUNCH_FAILED'
  }
  Move-Item -LiteralPath $requestPath -Destination (Join-Path $H "dispatch-processed-$($request.name)-$(Get-Date -Format yyyyMMdd-HHmmss).json")
}
Assert-CleanTickRepo
Assert-ExternalStateRoot
$ticks = Join-Path $H 'manager-ticks'; New-Item -ItemType Directory -Force $ticks | Out-Null
foreach ($f in 'manager-state.md', 'operator-inbox.md', 'manager-outbox.md') {
  $p = Join-Path $H $f; if (-not (Test-Path $p)) { New-Item -ItemType File $p | Out-Null }
}
$bash = 'C:\Program Files\Git\bin\bash.exe'
$lastDigest = ''; $lastTick = [datetime]::MinValue

while ($true) {
  git -C $repo fetch -q origin 2>$null
  # The tick never fast-forwards its worktree: its disposable mirror reads current files from origin/main.
  Assert-CleanTickRepo
  Sync-ManagerSnapshot
  $status =& $bash (Join-Path $snapshot 'ops/lane-c/status.sh') 2>&1 | Out-String
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
    $worktreeBaseline = Get-WorktreeFingerprints
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
    # Timeboxed operator decision: full access with an after-tick detect-and-stop guard.
    $promptPath = Join-Path $ticks "$stamp.prompt.md"
    $resultPath = Join-Path $ticks "$stamp.md"
    $logPath = Join-Path $ticks "$stamp.log"
    $errorPath = Join-Path $ticks "$stamp.err.log"
    Set-Content -LiteralPath $promptPath -Value $prompt -Encoding utf8
    $cli = 'C:\Users\njgro\AppData\Roaming\npm\codex.cmd'
    $args = @('exec', '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check', '-C', $H, '-m', $Model,
      '-c', "model_reasoning_effort=$Effort", '-o', $resultPath, '-')
    $tickProcess = Start-Process -FilePath $cli -ArgumentList $args -WorkingDirectory $H -WindowStyle Hidden -PassThru `
      -RedirectStandardInput $promptPath -RedirectStandardOutput $logPath -RedirectStandardError $errorPath
    if (-not $tickProcess.WaitForExit(120000)) {
      & cmd.exe /c "taskkill /pid $($tickProcess.Id) /t /f >NUL 2>&1"
      & (Join-Path $snapshot 'ops/lane-c/codex/notify.ps1') -Text 'Lane C manager tick timed out after two minutes and was stopped.'
    }
    Remove-Item Env:CODEX_HOME
    Remove-Item Env:ATLAS_MANAGER_REPO
    Assert-TickRepoUnchanged -Head $tickHead
    Assert-WorktreesUnchanged -Before $worktreeBaseline
    Process-DispatchRequest
    Write-Host "$(Get-Date -Format HH:mm) tick ($why): $(Get-Content (Join-Path $ticks "$stamp.md") -Tail 1 -EA SilentlyContinue)"
    $lastTick = Get-Date
    $lastDigest = $digest  # recompute next loop; changes made by the tick itself trigger at most one follow-up tick
  }
  Start-Sleep -Seconds ($Minutes * 60)
}
