# Start a detached Codex QA / browser-walk job on the QA account (default ~/.codex, paired with Brave).
# Result: $LANE_C_HOME/codex-qa/<Job>/final.md (+ run.log). The manager reads it on a later tick.
param(
  [Parameter(Mandatory)][string]$Job,
  [Parameter(Mandatory)][string]$PromptFile,
  [string]$QaHome = "$env:USERPROFILE\.codex",
  [string]$Effort = 'low'
)
$H = if ($env:LANE_C_HOME) { $env:LANE_C_HOME } else { 'D:\ATLAS-lane-c' }
$dir = Join-Path $H "codex-qa\$Job"
if (Test-Path (Join-Path $dir 'run.log')) { throw "job $Job already exists; pick a new name" }
New-Item -ItemType Directory -Force $dir | Out-Null
Copy-Item $PromptFile (Join-Path $dir 'prompt.md')
$cmd = "set CODEX_HOME=$QaHome&& codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check " +
       "-C D:\ATLAS -c model_reasoning_effort=$Effort -o `"$dir\final.md`" - < `"$dir\prompt.md`" > `"$dir\run.log`" 2>&1"
$p = Start-Process cmd.exe -ArgumentList '/c', $cmd -WindowStyle Hidden -PassThru
Set-Content (Join-Path $dir 'pid') $p.Id
"started $Job pid $($p.Id) -> $dir\final.md"
