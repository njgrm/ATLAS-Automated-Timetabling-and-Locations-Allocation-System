[CmdletBinding()]
param(
  [string]$Endpoint = 'http://127.0.0.1:5001/api/v1/health/activity',
  [string]$InboxPath = 'D:\ATLAS-lane-c\operator-inbox.md',
  [ValidateRange(1, 120)][int]$QuiescenceMinutes = 15
)

$ErrorActionPreference = 'Stop'
$now = [DateTimeOffset]::UtcNow
$reasons = [System.Collections.Generic.List[string]]::new()
$activity = $null

try {
  $activity = Invoke-RestMethod -Uri $Endpoint -TimeoutSec 10 -Method Get
  $observedAt = [DateTimeOffset]::Parse([string]$activity.observationStartedAt).ToUniversalTime()
  $observedMinutes = ($now - $observedAt).TotalMinutes
  if ($observedMinutes -lt $QuiescenceMinutes) {
    $reasons.Add("OBSERVATION_WINDOW_TOO_SHORT:$([math]::Floor($observedMinutes))m")
  }
  if ($null -ne $activity.lastInteractiveAt) {
    $lastUse = [DateTimeOffset]::Parse([string]$activity.lastInteractiveAt).ToUniversalTime()
    $idleMinutes = ($now - $lastUse).TotalMinutes
    if ($idleMinutes -lt $QuiescenceMinutes) {
      $reasons.Add("RECENT_LIVE_API_ACTIVITY:$([math]::Floor($idleMinutes))m")
    }
  }
  if ($activity.generationOrPublicationInFlight -eq $true) {
    $reasons.Add('GENERATION_OR_PUBLICATION_RUNNING')
  }
} catch {
  $reasons.Add('ACTIVITY_TELEMETRY_UNAVAILABLE')
}

if (-not (Test-Path -LiteralPath $InboxPath)) {
  $reasons.Add('OPERATOR_INBOX_UNAVAILABLE')
} elseif ((Get-Content -Raw -LiteralPath $InboxPath) -match '(?im)\b(using\s+live|no\s+deploys)\b') {
  $reasons.Add('OPERATOR_DEPLOY_VETO')
}

$result = [ordered]@{
  eligible = $reasons.Count -eq 0
  checkedAtUtc = $now.ToString('o')
  quiescenceMinutes = $QuiescenceMinutes
  reasons = @($reasons)
  activity = if ($null -eq $activity) { $null } else { [ordered]@{
    observationStartedAt = $activity.observationStartedAt
    lastInteractiveAt = $activity.lastInteractiveAt
    generationOrPublicationInFlight = $activity.generationOrPublicationInFlight
  }}
}
$result | ConvertTo-Json -Depth 4
if (-not $result.eligible) { exit 2 }
