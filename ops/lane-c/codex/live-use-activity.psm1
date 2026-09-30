function Get-ObservationWindowReason {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][DateTimeOffset]$NowUtc,
    [Parameter(Mandatory)][string]$ObservationStartedAt,
    [ValidateRange(1, 120)][int]$QuiescenceMinutes = 15,
    [Parameter(Mandatory)][string]$ReasonPrefix
  )

  $observedAt = [DateTimeOffset]::Parse($ObservationStartedAt).ToUniversalTime()
  $observedMinutes = ($NowUtc - $observedAt).TotalMinutes
  if ($observedMinutes -lt $QuiescenceMinutes) {
    return "${ReasonPrefix}:$([math]::Floor($observedMinutes))m"
  }
  return $null
}

Export-ModuleMember -Function Get-ObservationWindowReason
