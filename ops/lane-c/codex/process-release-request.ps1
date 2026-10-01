# Trusted release boundary. Ticks can only request and read; this wrapper performs each mutable release step.
param(
  [string]$Repo = 'D:\ATLAS',
  [string]$IntegrationRepo = 'E:\ATLAS-worktrees\lane-c-integrator-20261001',
  [string]$LaneHome = 'D:\ATLAS-lane-c',
  [int]$ScreenshotTimeoutMinutes = 12
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath $Repo).Path
$integrator = (Resolve-Path -LiteralPath $IntegrationRepo).Path
$laneRoot = (Resolve-Path -LiteralPath $LaneHome).Path
$requestPath = Join-Path $laneRoot 'release-request.json'
$resultPath = Join-Path $laneRoot 'release-result.json'
$request = Get-Content -LiteralPath $requestPath -Raw | ConvertFrom-Json
$typecheckResult = $null
foreach ($field in 'sha', 'train', 'mode') { if (-not $request.$field) { throw "INVALID_RELEASE_REQUEST:missing_$field" } }
if ($request.sha -notmatch '^[0-9a-f]{40}$' -or "$($request.train)" -notmatch '^[0-9]+$' -or $request.mode -notin @('dry-run', 'release')) { throw 'INVALID_RELEASE_REQUEST:shape' }
git -C $repo fetch -q origin
$main = (git -C $repo rev-parse origin/main).Trim()
if ($request.sha -ne $main) { throw "REFUSED_RELEASE_REQUEST:not_current_main:$($request.sha):$main" }
if (@(git -C $integrator status --porcelain).Count) { throw "REFUSED_RELEASE_REQUEST:integrator_dirty:$integrator" }

function Write-Receipt([string]$Status, [hashtable]$Extra = @{}) {
  $payload = [ordered]@{ status = $Status; train = "$($request.train)"; sha = $request.sha; mode = $request.mode; completedAt = (Get-Date).ToString('o') }
  foreach ($key in $Extra.Keys) { $payload[$key] = $Extra[$key] }
  if ($null -ne $typecheckResult) { $payload.typecheck = $typecheckResult }
  [IO.File]::WriteAllText($resultPath, ($payload | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
}
function Get-DeclaredSuiteFiles([string]$Where, [string]$ScriptName) {
  $package = Get-Content -LiteralPath (Join-Path $Where 'package.json') -Raw | ConvertFrom-Json
  $command = [string]$package.scripts.$ScriptName
  $declared = $null
  foreach ($mode in @('node --experimental-test-module-mocks --import tsx', 'node --import tsx', 'tsx')) {
    if ($command -match ('^' + [regex]::Escape($mode) + ' --test (.+)$')) { $declared = $Matches[1]; break }
  }
  if (-not $declared) { throw "RELEASE_SUITE_UNSUPPORTED:$ScriptName" }
  $tests = @($declared -split ' ' | Where-Object { $_ -match '\.test\.(ts|tsx|mts)$' })
  if (-not $tests.Count) { throw "RELEASE_SUITE_EMPTY:$ScriptName" }
  return , $tests
}
function Get-DeclaredMode([string]$Where, [string]$TestFile) {
  # A file's own package script may require node's module-mock loader. That declared mode is load-bearing for that
  # file and must survive batching; forcing the suite's runner on it fails with 'mock.module is not a function'.
  $package = Get-Content -LiteralPath (Join-Path $Where 'package.json') -Raw | ConvertFrom-Json
  foreach ($property in $package.scripts.PSObject.Properties) {
    $value = [string]$property.Value
    if ($value -notmatch '^node --experimental-test-module-mocks --import tsx --test (.+)$') { continue }
    $files = @($Matches[1] -split ' ' | Where-Object { $_ -match '\.test\.(ts|tsx|mts)$' })
    if ($files -contains $TestFile) { return 'module-mocks' }
  }
  return 'tsx'
}
function Invoke-SuiteFile([string]$Where, [string]$TestFile, [string]$Mode) {
  Push-Location $Where
  try {
    if ($Mode -eq 'module-mocks') { & node --experimental-test-module-mocks --import tsx --test $TestFile | Out-Host }
    else { & (Join-Path $Where 'node_modules\.bin\tsx.cmd') --test $TestFile | Out-Host }
    return $LASTEXITCODE
  }
  finally { Pop-Location }
}
function Compare-FailingFileWithLive([string]$Where, [string]$TestFile) {
  # Classify a suite failure by running that exact file against the live release in its own declared runner mode.
  # Machine scope is authoritative for runtime identity; the caller's inherited environment is never trusted.
  $liveSha = [Environment]::GetEnvironmentVariable('ATLAS_RUNTIME_RELEASE_SHA', 'Machine')
  $liveDir = [Environment]::GetEnvironmentVariable('ATLAS_RUNTIME_SOURCE_DIR', 'Machine')
  if ($liveSha -notmatch '^[0-9a-f]{40}$' -or -not $liveDir -or -not (Test-Path -LiteralPath $liveDir)) { return "LIVE_BASELINE_UNAVAILABLE:${liveSha}:${liveDir}" }
  $head = (git -C $liveDir rev-parse HEAD 2>$null)
  if ($LASTEXITCODE -ne 0 -or "$head".Trim() -ne $liveSha) { return "LIVE_BASELINE_MISMATCH:${liveSha}:$("$head".Trim())" }
  $livePackage = Join-Path $liveDir (Split-Path -Leaf $Where)
  if (-not (Test-Path -LiteralPath $livePackage)) { return "LIVE_BASELINE_UNAVAILABLE:${livePackage}" }
  $liveFile = Join-Path $livePackage ($TestFile -replace '/', '\')
  if (-not (Test-Path -LiteralPath $liveFile)) { return "NEW(absent-at-live:${liveSha})" }
  if (-not (Test-Path -LiteralPath (Join-Path $livePackage 'node_modules\.bin\tsx.cmd'))) { return "LIVE_RUNNER_MISSING:${livePackage}" }
  $liveMode = Get-DeclaredMode $livePackage $TestFile
  if ((Invoke-SuiteFile $livePackage $TestFile $liveMode) -eq 0) { return "NEW(passes-at-live:${liveMode}:${liveSha})" }
  return "PRE-EXISTING(fails-at-live:${liveMode}:${liveSha})"
}
function Invoke-DeclaredSuite([string]$Where, [string]$ScriptName, [System.Collections.Generic.List[object]]$Ledger) {
  $tests = Get-DeclaredSuiteFiles $Where $ScriptName
  $tsx = Join-Path $Where 'node_modules\.bin\tsx.cmd'
  if (-not (Test-Path -LiteralPath $tsx)) { throw "RELEASE_SUITE_RUNNER_MISSING:$ScriptName" }
  $plan = foreach ($test in $tests) { [pscustomobject]@{ file = $test; mode = (Get-DeclaredMode $Where $test) } }
  # The declared suite has outgrown Windows' cmd.exe command-line maximum. Execute every exact listed test in
  # deterministic small batches, grouped by the runner mode each file declares, rather than silently shrinking it.
  foreach ($group in ($plan | Group-Object mode)) {
    $files = @($group.Group | ForEach-Object { $_.file })
    for ($offset = 0; $offset -lt $files.Count; $offset += 16) {
      $last = [Math]::Min($offset + 15, $files.Count - 1); $batch = @($files[$offset..$last])
      Push-Location $Where
      try {
        if ($group.Name -eq 'module-mocks') { & node --experimental-test-module-mocks --import tsx --test @batch }
        else { & $tsx --test @batch }
        $exitCode = $LASTEXITCODE
      }
      finally { Pop-Location }
      if ($exitCode -eq 0) { continue }
      foreach ($test in $batch) {
        $mode = ($plan | Where-Object { $_.file -eq $test }).mode
        if ((Invoke-SuiteFile $Where $test $mode) -eq 0) { continue }
        $Ledger.Add([pscustomobject]@{ suite = $ScriptName; file = $test; declaredMode = $mode; classification = (Compare-FailingFileWithLive $Where $test) })
      }
      throw "RELEASE_SUITE_FAILED:${ScriptName}:${offset}:${batch[0]}..${batch[-1]}:$exitCode"
    }
  }
}
function Commit-LiveState([string]$PreparedDir, [string]$Incumbent) {
  git -C $integrator fetch -q origin
  if ((git -C $integrator rev-parse HEAD).Trim() -ne $main) { git -C $integrator merge --ff-only origin/main | Out-Host }
  if ((git -C $integrator rev-parse HEAD).Trim() -ne $main) { throw 'REFUSED_RELEASE_REQUEST:integrator_not_at_target' }
  $file = Join-Path $integrator 'docs\plans\live-state.md'; $text = [IO.File]::ReadAllText($file)
  $targetShort = $request.sha.Substring(0, 8); $rollbackShort = $Incumbent.Substring(0, 8)
  if ($text -notmatch '(?m)^## Live release\s*$') { throw 'REFUSED_RELEASE_REQUEST:missing_live_release_section' }
  $insert = "`nTrain $($request.train) prepared target $targetShort from $PreparedDir; rollback basis $rollbackShort. Release task mode: $($request.mode).`n"
  $updated = [regex]::Replace($text, '(?m)^(## Live release\s*)$', ('$1' + $insert), 1)
  [IO.File]::WriteAllText($file, $updated, [Text.UTF8Encoding]::new($false))
  git -C $integrator add -- 'docs/plans/live-state.md'
  git -C $integrator diff --cached --check | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'REFUSED_RELEASE_REQUEST:live_state_whitespace' }
  $env:ATLAS_INTEGRATOR = '1'
  try {
    git -C $integrator commit -m "docs(release): prepare train $($request.train)" | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'REFUSED_RELEASE_REQUEST:live_state_commit' }
    git -C $integrator push origin HEAD:main | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'REFUSED_RELEASE_REQUEST:live_state_push' }
  } finally { Remove-Item Env:ATLAS_INTEGRATOR -ErrorAction SilentlyContinue }
}

try {
  # npm may write advisory warnings to stderr while succeeding. Preserve them in the receipt log, but decide this
  # native step only from its exit code rather than turning a warning record into a terminating PowerShell error.
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { $preparedLines = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'ops\runtime\release\release-prepare.ps1') -Sha $request.sha 2>&1 }
  finally { $ErrorActionPreference = $previousPreference }
  $preparedLines | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'RELEASE_PREPARE_FAILED' }
  $prepared = ($preparedLines | Where-Object { $_ -match '^\{"sha":' } | Select-Object -Last 1 | ConvertFrom-Json)
  if (-not $prepared.dir) { throw 'RELEASE_PREPARE_RESULT_INVALID' }
  $releaseDir = (Resolve-Path -LiteralPath $prepared.dir).Path
  $typecheckOutput = & node (Join-Path $releaseDir 'ops\lane-c\codex\typecheck-baseline.mjs') $releaseDir --origin-main
  $typecheckExit = $LASTEXITCODE
  try { $typecheckResult = $typecheckOutput | ConvertFrom-Json } catch { throw "TYPECHECK_BASELINE_INVALID_RESULT:$typecheckOutput" }
  if ($typecheckExit -ne 0 -or @($typecheckResult.unexpected).Count -gt 0 -or @($typecheckResult.baselineAdditions).Count -gt 0) {
    throw "TYPECHECK_BASELINE_VIOLATION:$(@{ unexpected = @($typecheckResult.unexpected); baselineAdditions = @($typecheckResult.baselineAdditions) } | ConvertTo-Json -Compress -Depth 5)"
  }
  $suiteFindings = [System.Collections.Generic.List[object]]::new()
  Invoke-DeclaredSuite (Join-Path $releaseDir 'atlas-client') 'test:client-suite' $suiteFindings
  Invoke-DeclaredSuite (Join-Path $releaseDir 'atlas-server') 'test:server-suite' $suiteFindings
  $job = "release-$($request.train)-$($request.sha.Substring(0,8))-1366"; $promptFile = Join-Path $laneRoot "$job.prompt.md"
  $qaPrompt = @"
Run isolated, read-only rendered QA for Train $($request.train) in $releaseDir. Do not use Tailnet, credentials, or live APIs.
At 1366x768 prove /timetable renders both its header and weekly grid from loading to resolved data, with no console error or global scroll.
Use the project's controlled loopback preview rules and save a screenshot under D:/ATLAS-lane-c/codex-qa/$job/.
End final.md with exactly one line: RELEASE_SCREENSHOT: PASS <absolute screenshot path>, or RELEASE_SCREENSHOT: FAIL <reason>.
"@
  [IO.File]::WriteAllText($promptFile, $qaPrompt, [Text.UTF8Encoding]::new($false))
  & (Join-Path $repo 'ops\lane-c\codex\codex-run.ps1') -Job $job -PromptFile $promptFile | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'RELEASE_SCREENSHOT_LAUNCH_FAILED' }
  $qaFinal = Join-Path $laneRoot "codex-qa\$job\final.md"; $deadline = (Get-Date).AddMinutes($ScreenshotTimeoutMinutes)
  while (-not (Test-Path -LiteralPath $qaFinal)) { if ((Get-Date) -gt $deadline) { throw 'RELEASE_SCREENSHOT_TIMEOUT' }; Start-Sleep -Seconds 10 }
  $qaResult = Get-Content -LiteralPath $qaFinal -Raw
  if ($qaResult -notmatch '(?m)^RELEASE_SCREENSHOT: PASS .+') { throw 'RELEASE_SCREENSHOT_REFUSED' }
  $incumbent = [Environment]::GetEnvironmentVariable('ATLAS_RUNTIME_RELEASE_SHA', 'Machine')
  if ($incumbent -notmatch '^[0-9a-f]{40}$') { throw 'RELEASE_INCUMBENT_UNKNOWN' }
  Commit-LiveState -PreparedDir $releaseDir -Incumbent $incumbent
  $taskLines = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'ops\runtime\release\release-request.ps1') -Dir $releaseDir -Mode $request.mode 2>&1
  $taskLines | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'RELEASE_TASK_REFUSED' }
  $task = $taskLines | Where-Object { $_ -match '^\{' } | Select-Object -Last 1 | ConvertFrom-Json
  Write-Receipt -Status $task.status -Extra @{ releaseDir = $releaseDir; task = $task; screenshot = ($qaResult | Select-String 'RELEASE_SCREENSHOT:' | Select-Object -Last 1).Line }
  Move-Item -LiteralPath $requestPath -Destination (Join-Path $laneRoot "release-processed-$($request.train)-$(Get-Date -Format yyyyMMdd-HHmmss).json")
} catch {
  $extra = @{ reason = $_.Exception.Message }
  if ($suiteFindings -and $suiteFindings.Count) { $extra.suiteFindings = @($suiteFindings) }
  Write-Receipt -Status 'REFUSED' -Extra $extra
  throw
}
