[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$modulePath = Join-Path $PSScriptRoot 'live-use-activity.psm1'
Import-Module -Name $modulePath -Force

$now = [DateTimeOffset]::Parse('2026-09-30T12:00:00Z')
$reason = Get-ObservationWindowReason -NowUtc $now -ObservationStartedAt '2026-09-30T11:59:00Z' -QuiescenceMinutes 15 -ReasonPrefix 'API_OBSERVATION_WINDOW_TOO_SHORT'
if ($reason -ne 'API_OBSERVATION_WINDOW_TOO_SHORT:1m') { throw "expected the fresh API observation to fail closed, got $reason" }

$quiet = Get-ObservationWindowReason -NowUtc $now -ObservationStartedAt '2026-09-30T11:45:00Z' -QuiescenceMinutes 15 -ReasonPrefix 'API_OBSERVATION_WINDOW_TOO_SHORT'
if ($null -ne $quiet) { throw "expected a full 15-minute API observation window to pass, got $quiet" }

'LIVE_USE_CHECK_API_WINDOW_TEST=PASS'
