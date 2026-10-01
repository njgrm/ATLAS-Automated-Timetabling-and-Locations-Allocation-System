# Trusted Lane C integration step. The manager only writes a bounded request; this wrapper is the sole main writer.
param(
  [Parameter(Mandatory = $true)][string]$Repo,
  [Parameter(Mandatory = $true)][string]$IntegrationRepo,
  [string]$LaneHome = 'D:\ATLAS-lane-c'
)

$ErrorActionPreference = 'Stop'
$requestPath = Join-Path $LaneHome 'integrate-request.json'
$resultPath = Join-Path $LaneHome 'integrate-result.json'
$typecheckResult = $null

function Write-Result([string]$status, [string]$message, [string]$head = '') {
  $result = [ordered]@{
    completedAt = (Get-Date).ToUniversalTime().ToString('o')
    status = $status
    message = $message
    head = $head
  }
  if ($null -ne $typecheckResult) { $result.typecheck = $typecheckResult }
  $json = $result | ConvertTo-Json -Depth 8
  [IO.File]::WriteAllText($resultPath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

function Stop-Request([string]$message) {
  Write-Result 'REJECTED' $message
  throw $message
}

try {
  if (-not (Test-Path -LiteralPath $requestPath)) { exit 0 }
  try { $request = Get-Content -LiteralPath $requestPath -Raw | ConvertFrom-Json } catch { Stop-Request "INVALID_INTEGRATE_REQUEST:$($_.Exception.Message)" }
  foreach ($property in 'name', 'tier', 'branch', 'sha', 'tests') {
    if (-not $request.$property) { Stop-Request "INVALID_INTEGRATE_REQUEST:missing_$property" }
  }
  if ($request.name -notmatch '^[a-z0-9][a-z0-9-]{0,63}$' -or
      $request.tier -notin @('T1', 'T2') -or
      $request.branch -notmatch '^(work|fix|feat)/[a-z0-9][a-z0-9-]{0,63}$' -or
      $request.sha -notmatch '^[0-9a-f]{40}$' -or
      @($request.tests).Count -lt 1) {
    Stop-Request 'INVALID_INTEGRATE_REQUEST:shape_or_tier'
  }
  foreach ($test in @($request.tests)) {
    if ($test -notmatch '^(atlas-client|atlas-server)/src/.+\.test\.(ts|tsx|mts)$' -or $test -match '[\\/]{2}|\.\.') {
      Stop-Request "INVALID_INTEGRATE_REQUEST:test:$test"
    }
  }

  $Repo = (Resolve-Path -LiteralPath $Repo).Path
  $IntegrationRepo = (Resolve-Path -LiteralPath $IntegrationRepo).Path
  if ($IntegrationRepo -notlike 'E:\ATLAS-worktrees\*') { Stop-Request 'INVALID_INTEGRATION_WORKTREE:outside_E_root' }
  $integrationIdentity = $IntegrationRepo.Replace('\\', '/').TrimEnd('/').ToLowerInvariant()
  $registered = @(git -C $Repo worktree list --porcelain | Where-Object { $_ -like 'worktree *' } |
    ForEach-Object { (Resolve-Path -LiteralPath $_.Substring(9)).Path.Replace('\\', '/').TrimEnd('/').ToLowerInvariant() })
  if ($integrationIdentity -notin $registered) { Stop-Request 'INVALID_INTEGRATION_WORKTREE:unregistered' }
  if (@(git -C $IntegrationRepo status --short).Count) { Stop-Request 'INTEGRATION_WORKTREE_DIRTY' }

  git -C $Repo fetch -q origin $request.branch
  git -C $Repo cat-file -e "$($request.sha)^{commit}"
  if ($LASTEXITCODE -ne 0) { Stop-Request 'CANDIDATE_NOT_IN_SHARED_REPOSITORY' }
  $remoteCandidate = (git -C $Repo rev-parse "origin/$($request.branch)").Trim()
  if ($remoteCandidate -ne $request.sha) { Stop-Request 'CANDIDATE_SHA_DOES_NOT_MATCH_BRANCH' }
  git -C $Repo merge-base --is-ancestor origin/main $request.sha
  if ($LASTEXITCODE -ne 0) { Stop-Request 'CANDIDATE_NOT_CURRENT_MAIN_BASED' }

  git -C $IntegrationRepo fetch -q origin
  $integrationHead = (git -C $IntegrationRepo rev-parse HEAD).Trim()
  $mainHead = (git -C $IntegrationRepo rev-parse origin/main).Trim()
  if ($integrationHead -ne $mainHead) { Stop-Request 'INTEGRATION_WORKTREE_NOT_AT_ORIGIN_MAIN' }

  git -C $IntegrationRepo merge --no-ff $request.sha -m "merge($($request.tier.ToLowerInvariant())): $($request.name)"
  if ($LASTEXITCODE -ne 0) {
    git -C $IntegrationRepo merge --abort 2>$null
    Stop-Request 'MERGE_CONFLICT'
  }

  $clientTests = @($request.tests | Where-Object { $_ -like 'atlas-client/*' } | ForEach-Object { $_.Substring('atlas-client/'.Length) })
  $serverTests = @($request.tests | Where-Object { $_ -like 'atlas-server/*' } | ForEach-Object { $_.Substring('atlas-server/'.Length) })
  if ($clientTests.Count) {
    $tsx = Join-Path $IntegrationRepo 'atlas-client\node_modules\.bin\tsx.cmd'
    if (-not (Test-Path -LiteralPath $tsx)) { throw 'CLIENT_TEST_RUNNER_MISSING' }
    Push-Location (Join-Path $IntegrationRepo 'atlas-client')
    try { & $tsx --test @clientTests; if ($LASTEXITCODE -ne 0) { throw "CLIENT_TESTS_FAILED:$LASTEXITCODE" } } finally { Pop-Location }
  }
  if ($serverTests.Count) {
    $tsx = Join-Path $IntegrationRepo 'atlas-server\node_modules\.bin\tsx.cmd'
    if (-not (Test-Path -LiteralPath $tsx)) { throw 'SERVER_TEST_RUNNER_MISSING' }
    Push-Location (Join-Path $IntegrationRepo 'atlas-server')
    try { & $tsx --test @serverTests; if ($LASTEXITCODE -ne 0) { throw "SERVER_TESTS_FAILED:$LASTEXITCODE" } } finally { Pop-Location }
  }
  $typecheckOutput = & node (Join-Path $IntegrationRepo 'ops\lane-c\codex\typecheck-baseline.mjs') $IntegrationRepo (Join-Path $Repo 'ops\lane-c\tsc-baseline.json')
  $typecheckExit = $LASTEXITCODE
  try { $typecheckResult = $typecheckOutput | ConvertFrom-Json } catch { throw "TYPECHECK_BASELINE_INVALID_RESULT:$typecheckOutput" }
  if ($typecheckExit -ne 0 -or @($typecheckResult.unexpected).Count -gt 0 -or @($typecheckResult.baselineAdditions).Count -gt 0) {
    throw "TYPECHECK_BASELINE_VIOLATION:$(@{ unexpected = @($typecheckResult.unexpected); baselineAdditions = @($typecheckResult.baselineAdditions) } | ConvertTo-Json -Compress -Depth 5)"
  }
  git -C $IntegrationRepo diff --check
  if ($LASTEXITCODE -ne 0) { throw 'MERGE_DIFF_CHECK_FAILED' }
  $previousIntegrator = $env:ATLAS_INTEGRATOR
  try {
    $env:ATLAS_INTEGRATOR = '1'
    git -C $IntegrationRepo push origin HEAD:main
    if ($LASTEXITCODE -ne 0) { throw "PUSH_FAILED:$LASTEXITCODE" }
  } finally {
    if ($null -eq $previousIntegrator) { Remove-Item Env:ATLAS_INTEGRATOR -ErrorAction SilentlyContinue } else { $env:ATLAS_INTEGRATOR = $previousIntegrator }
  }
  git -C $IntegrationRepo fetch -q origin
  $head = (git -C $IntegrationRepo rev-parse HEAD).Trim()
  if ($head -ne (git -C $IntegrationRepo rev-parse origin/main).Trim()) { throw 'PUSH_DID_NOT_ADVANCE_ORIGIN_MAIN' }
  Move-Item -LiteralPath $requestPath -Destination (Join-Path $LaneHome ("integrate-processed-{0}-{1}.json" -f $request.name, (Get-Date -Format 'yyyyMMdd-HHmmss')))
  Write-Result 'INTEGRATED' 'Candidate merged, focused tests passed, and main was pushed.' $head
} catch {
  $message = $_.Exception.Message
  if ($message -notmatch '^INVALID_|^CANDIDATE_|^INTEGRATION_|^MERGE_CONFLICT$') {
    try { git -C $IntegrationRepo merge --abort 2>$null } catch { }
    Write-Result 'FAILED' $message
  }
  exit 1
}
