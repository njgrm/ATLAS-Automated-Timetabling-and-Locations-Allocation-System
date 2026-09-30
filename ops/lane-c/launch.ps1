# Lane C detached launcher. Every planner receives a manager-provisioned E: worktree;
# D:\ATLAS is a dirty integration surface and is never a planner workspace.
param(
  [Parameter(Mandatory)][string]$Name,
  [Parameter(Mandatory)][string]$Prompt,
  [string]$Session,
  [ValidateSet('atlas-planner','atlas-executor','atlas-qa','atlas-wave-auditor')][string]$Agent = 'atlas-planner',
  [switch]$Force,
  [Parameter(Mandatory)][string]$Dir
)
$runs = if ($env:LANE_C_HOME) { Join-Path $env:LANE_C_HOME 'runs' } else { 'D:\ATLAS-lane-c\runs' }
New-Item -ItemType Directory -Force $runs | Out-Null
$log = Join-Path $runs "$Name.log"
if ($Prompt -match '"') { throw 'Prompt contains a double quote' }
# 30 Sep 05:45: a multi-line prompt split the cmd.exe line and the run died with an empty log (a9-ds-sections, a6-ds-tllayout, a5-ds-docx1). Collapse newlines; refuse cmd redirection characters.
$Prompt = ($Prompt -replace '\r?\n', ' ').Trim()
if ($Prompt -match '[<>|&^%]') { $Prompt = $Prompt -replace '<', ' less than ' -replace '>', ' then ' -replace '\|', '/' -replace '&', 'and' -replace '\^', '' -replace '%', ' percent' }
# Guard (Lane C, 30 Sep): cap concurrent planners at 6 and refuse to launch under memory pressure. -Force overrides for A4 deploys.
if (-not $Force) {
  $running = @(Get-CimInstance Win32_Process -Filter "Name='opencode.exe'" | Where-Object { $_.CommandLine -match ' run ' }).Count
  $os = Get-CimInstance Win32_OperatingSystem
  $commitFreeGB = [math]::Round($os.FreeVirtualMemory/1MB,1)
  if ($running -ge 6) { throw "CAP_REACHED: $running planners running (cap 6). Queue this launch." }
  if ($commitFreeGB -lt 6) { throw "LOW_MEMORY: only $commitFreeGB GB commit free (need 6). Queue this launch." }
}
$oc = 'C:\Users\njgro\AppData\Roaming\npm\node_modules\opencode-ai\bin\opencode.exe'
$attach = ''  # the elevated :4097 server is retired (2026-09-30); no planner runs elevated
if ($Session) { $attach += "--session $Session " }
# The manager pins the worktree base before launch; never pull a shared root here.
$resolvedDir = (Resolve-Path -LiteralPath $Dir -ErrorAction Stop).Path
if ($resolvedDir -notlike 'E:\ATLAS-worktrees\*') { throw "REFUSING_UNPINNED_WORKTREE:$resolvedDir" }
$normalizedDir = $resolvedDir.Replace('\','/').TrimEnd('/').ToLowerInvariant()
$registered = @(git -C D:\ATLAS worktree list --porcelain | Where-Object { $_ -like 'worktree *' } |
  ForEach-Object { $_.Substring(9).Replace('\','/').TrimEnd('/').ToLowerInvariant() })
if ($registered -notcontains $normalizedDir) { throw "REFUSING_UNREGISTERED_WORKTREE:$resolvedDir" }
if (-not $Session) {
  $head = (git -C $resolvedDir rev-parse HEAD).Trim()
  $main = (git -C D:\ATLAS rev-parse origin/main).Trim()
  if ($head -ne $main) { throw "REFUSING_STALE_WORKTREE_BASE:$head expected=$main" }
}
$cmd = "cmd.exe /c set OPENCODE_SERVER_PASSWORD=&& cd /d `"$resolvedDir`" && echo dir $resolvedDir > `"$log`" & `"$oc`" run $attach--dir `"$resolvedDir`" --agent $Agent `"$Prompt`" < NUL >> `"$log`" 2>&1"
$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }  # hidden: an operator closing a stray console window killed a2-c12r
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = 'D:\ATLAS'; ProcessStartupInformation = $si }
if ($r.ReturnValue -ne 0) { throw "Create failed: $($r.ReturnValue)" }
Set-Content -Path (Join-Path $runs "$Name.pid") -Value $r.ProcessId
"$Name PID $($r.ProcessId) log $log"
