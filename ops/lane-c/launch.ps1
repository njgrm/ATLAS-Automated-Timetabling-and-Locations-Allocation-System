# Lane C detached launcher. Starts an opencode planner OUTSIDE Claude Code's process tree (via CIM), so a Claude crash
# cannot kill it. -Session <id> continues a session that ended its turn early (model stopped after stating intent). Usage: launch.ps1 -Name a2-c11r -Prompt "..." [-Elevated]. Prompt must not contain double quotes.
param([string]$Name,[string]$Prompt,[switch]$Elevated,[string]$Session,[string]$Agent = 'atlas-planner',[switch]$Force)
$runs = if ($env:LANE_C_HOME) { Join-Path $env:LANE_C_HOME 'runs' } else { 'D:\ATLAS-lane-c\runs' }
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
$attach = if ($Elevated) { '--attach http://127.0.0.1:4097 ' } else { '' }
if ($Session) { $attach += "--session $Session " }
$cmd = "cmd.exe /c set OPENCODE_SERVER_PASSWORD=&& cd /d D:\ATLAS && (git pull -q --ff-only || (ping -n 6 127.0.0.1 >NUL & git pull -q --ff-only)) > `"$log`" 2>&1 & `"$oc`" run $attach--dir D:\ATLAS --agent $Agent `"$Prompt`" < NUL >> `"$log`" 2>&1"  # a6-hdr1 lost a concurrent git-pull race and never started; pull failure no longer skips the run
$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }  # hidden: an operator closing a stray console window killed a2-c12r
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = 'D:\ATLAS'; ProcessStartupInformation = $si }
if ($r.ReturnValue -ne 0) { throw "Create failed: $($r.ReturnValue)" }
Set-Content -Path (Join-Path $runs "$Name.pid") -Value $r.ProcessId
"$Name PID $($r.ProcessId) log $log"
