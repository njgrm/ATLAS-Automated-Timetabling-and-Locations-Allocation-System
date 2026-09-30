[CmdletBinding()]
param(
  [string]$HostEndpoint = 'http://127.0.0.1:5174/__host/activity',
  [string]$ApiEndpoint = 'http://127.0.0.1:5001/api/v1/health/activity',
  [string]$InboxPath = 'D:\ATLAS-lane-c\operator-inbox.md',
  [ValidateRange(1, 120)][int]$QuiescenceMinutes = 15
)

$ErrorActionPreference = 'Stop'
$modulePath = Join-Path $PSScriptRoot 'live-use-activity.psm1'
Import-Module -Name $modulePath -Force
$now = [DateTimeOffset]::UtcNow
$reasons = [System.Collections.Generic.List[string]]::new()
$hostActivity = $null
$apiActivity = $null

try {
  $hostActivity = Invoke-RestMethod -Uri $HostEndpoint -TimeoutSec 10 -Method Get
  $hostWindowReason = Get-ObservationWindowReason -NowUtc $now -ObservationStartedAt ([string]$hostActivity.observationStartedAt) -QuiescenceMinutes $QuiescenceMinutes -ReasonPrefix 'OBSERVATION_WINDOW_TOO_SHORT'
  if ($null -ne $hostWindowReason) { $reasons.Add($hostWindowReason) }
  if ($null -ne $hostActivity.lastInteractiveAt) {
    $lastUse = [DateTimeOffset]::Parse([string]$hostActivity.lastInteractiveAt).ToUniversalTime()
    $idleMinutes = ($now - $lastUse).TotalMinutes
    if ($idleMinutes -lt $QuiescenceMinutes) {
      $reasons.Add("RECENT_LIVE_API_ACTIVITY:$([math]::Floor($idleMinutes))m")
    }
  }
} catch {
  $reasons.Add('CLIENT_ACTIVITY_TELEMETRY_UNAVAILABLE')
}

try {
  $apiActivity = Invoke-RestMethod -Uri $ApiEndpoint -TimeoutSec 10 -Method Get
  $apiWindowReason = Get-ObservationWindowReason -NowUtc $now -ObservationStartedAt ([string]$apiActivity.observationStartedAt) -QuiescenceMinutes $QuiescenceMinutes -ReasonPrefix 'API_OBSERVATION_WINDOW_TOO_SHORT'
  if ($null -ne $apiWindowReason) { $reasons.Add($apiWindowReason) }
  if ($apiActivity.generationOrPublicationInFlight -eq $true) {
    $reasons.Add('GENERATION_OR_PUBLICATION_RUNNING')
  }
} catch {
  $reasons.Add('API_ACTIVITY_TELEMETRY_UNAVAILABLE')
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
  clientActivity = if ($null -eq $hostActivity) { $null } else { [ordered]@{ observationStartedAt = $hostActivity.observationStartedAt; lastInteractiveAt = $hostActivity.lastInteractiveAt }}
  apiActivity = if ($null -eq $apiActivity) { $null } else { [ordered]@{ observationStartedAt = $apiActivity.observationStartedAt; generationOrPublicationInFlight = $apiActivity.generationOrPublicationInFlight }}
}
$result | ConvertTo-Json -Depth 4
if (-not $result.eligible) { exit 2 }
