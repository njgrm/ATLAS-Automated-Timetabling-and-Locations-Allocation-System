<#
.SYNOPSIS
    Re-snapshot the live ATLAS database into the staging database.

.DESCRIPTION
    Streams `pg_dump -Fc | pg_restore` from the live database into `atlas_staging`
    so staging renders real data without ever writing the live database.

    Fail-closed rules, all of which abort before any destructive step:

      * The target database name must equal -StagingDatabase, which itself
        defaults to `atlas_staging` and is rejected if it ever resolves to the
        live database name. A copy of the live password into a drop-and-recreate
        against the wrong name would destroy production data, so this is not a
        warning.
      * No schema command is ever run. Staging takes its schema from the stream, so
        `prisma migrate` / `db push` are not part of this script and no migration
        is applied to either database.
      * THE ARCHIVE NEVER TOUCHES DISK. A `pg_dump -Fc` of the live database
        contains JWT_SECRET, ATLAS_SYSTEM_TOKEN, ENROLLPRO_SSO_CLIENT_SECRET,
        ATLAS_SSO_REVERSE_CLIENT_SECRET, ENROLLPRO_SERVICE_TOKEN and password
        hashes. Writing it to a file is a credential-at-rest exposure that no
        stdout scrub covers, so the dump is piped directly into pg_restore.
      * The password is injected into the child environment as PGPASSWORD and
        never appears on a command line, in output, or in an audit record.
      * The live and staging env files are only *read*. Neither is modified.

.PARAMETER Execute
    Without it the script prints the plan and touches nothing.

.EXAMPLE
    .\refresh-db.ps1 -Execute
#>
[CmdletBinding()]
param(
    [string] $LiveEnvFile    = 'D:\ATLAS-runtime-config\atlas-server.env',
    [string] $StagingEnvFile = 'D:\ATLAS-runtime-config\atlas-staging.env',
    [string] $StagingDatabase = 'atlas_staging',
    [string] $PgBin          = 'D:\PostgreSQL\18\bin',
    [string] $AuditRoot      = 'C:\ProgramData\ATLAS\staging-audit',
    [switch] $Execute
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'staging-common.ps1')

function Fail([string] $Message) { throw "STAGING_DB_STOP: $Message" }

# The live signature is `max(audit_logs.id)|row count|_prisma_migrations count`.
# Selected by shape, not by stream index: psql writes NOTICE lines to stderr and
# this caller merges stderr into stdout, so index 0 can be a NOTICE.
$SignaturePattern = '^\d+\|\d+\|\d+$'

# ---------------------------------------------------------------- preconditions
if (-not (Test-Path -LiteralPath $LiveEnvFile))   { Fail "Live env file not found: $LiveEnvFile" }
if (-not (Test-Path -LiteralPath $StagingEnvFile)) { Fail "Staging env file not found: $StagingEnvFile. Run deploy-staging.ps1 first." }

$liveMap    = Get-AtlasEnvMap -Path $LiveEnvFile
$stagingMap = Get-AtlasEnvMap -Path $StagingEnvFile
$liveConn   = Get-PgConnection $liveMap
$stgConn    = Get-PgConnection $stagingMap

# The single most important guard in this script.
if ($StagingDatabase -ceq $liveConn.Database) { Fail 'Target database name equals the live database name. Refusing.' }
if ($stgConn.Database -cne $StagingDatabase)  { Fail "Staging env file points at '$($stgConn.Database)' but the target is '$StagingDatabase'. Refusing." }
if ($stgConn.Host -cne $liveConn.Host -or $stgConn.Port -ne $liveConn.Port) {
    Fail 'Staging and live must be on the same PostgreSQL server for a dump/restore copy. Refusing.'
}
if ($StagingDatabase -notmatch '^[a-z_][a-z0-9_]*$') { Fail "Unsafe target database name '$StagingDatabase'." }

$mode = if ($Execute) { 'execute' } else { 'dry-run' }
$plan = [ordered]@{
    mode                = $mode
    liveDatabase        = $liveConn.Database
    stagingDatabase     = $StagingDatabase
    server              = "$($liveConn.Host):$($liveConn.Port)"
    method              = 'pg_dump -Fc | pg_restore  (streamed; archive never written to disk)'
    dropsExistingTarget = [bool]$Execute
    mutates             = [bool]$Execute
    secretsPrinted      = $false
    writesCredentialsToDisk = $false
    appliesMigration    = $false
    writesLiveDatabase  = $false
    rollback            = 'The live database is only read. To undo, drop the staging database: psql -c "DROP DATABASE atlas_staging".'
}
$plan | ConvertTo-Json -Depth 4
if (-not $Execute) { exit 0 }

# ------------------------------------------------------------------- audit dir
# Restrict the audit directory to the same principals as the live env file, so a
# transcript of run metadata is not world-readable.
if (-not (Test-Path -LiteralPath $AuditRoot)) { New-Item -ItemType Directory -Force -Path $AuditRoot | Out-Null }
Set-Acl -LiteralPath $AuditRoot -AclObject (Get-Acl -LiteralPath $LiveEnvFile)
$stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path $AuditRoot "refresh-db-$stamp.log"

$log = New-Object System.Collections.Generic.List[string]
$log.Add("startedAtUtc=$((Get-Date).ToUniversalTime().ToString('o'))")
$log.Add("liveDatabase=$($liveConn.Database)")
$log.Add("stagingDatabase=$StagingDatabase")
$log.Add("archiveWrittenToDisk=false")

function Get-LiveSignature {
    $lines = Invoke-PgTool -PgBin $PgBin -Tool 'psql.exe' -EnvMap $liveMap -Database $liveConn.Database `
        -Arguments @('-d', $liveConn.Database, '-tAc',
            "select coalesce(max(id),0)::text || '|' || count(*)::text || '|' || (select count(*) from _prisma_migrations)::text from audit_logs;")
    return (Get-AtlasScalar -Lines $lines -Pattern $SignaturePattern)
}

$before = Get-LiveSignature
$log.Add("liveBefore=$before")

# Drop and recreate so a refresh cannot leave stale rows from a previous snapshot.
$null = Invoke-PgTool -PgBin $PgBin -Tool 'psql.exe' -EnvMap $liveMap -Database 'postgres' `
    -Arguments @('-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c',
        "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$StagingDatabase' and pid <> pg_backend_pid();")
$null = Invoke-PgTool -PgBin $PgBin -Tool 'psql.exe' -EnvMap $liveMap -Database 'postgres' `
    -Arguments @('-v', 'ON_ERROR_STOP=1', '-c', "drop database if exists `"$StagingDatabase`";")
$null = Invoke-PgTool -PgBin $PgBin -Tool 'psql.exe' -EnvMap $liveMap -Database 'postgres' `
    -Arguments @('-v', 'ON_ERROR_STOP=1', '-c', "create database `"$StagingDatabase`";")

# The archive is the POSITIONAL argument to pg_restore. `-f` is pg_restore's
# OUTPUT-file option, so passing the dump path to `-f` makes pg_restore overwrite
# the very archive it is meant to restore from. This was a reviewed BLOCKING defect.
Invoke-PgPipeline -PgBin $PgBin -EnvMap $liveMap `
    -DumpArguments    @('-d', $liveConn.Database, '-Fc', '--no-owner', '--no-privileges') `
    -RestoreArguments @('-d', $StagingDatabase, '--no-owner', '--no-privileges', '--exit-on-error')

# ------------------------------------------------------------------ verify
$stagingLines = Invoke-PgTool -PgBin $PgBin -Tool 'psql.exe' -EnvMap $stagingMap -Database $StagingDatabase `
    -Arguments @('-d', $StagingDatabase, '-tAc',
        "select coalesce(max(id),0)::text || '|' || count(*)::text || '|' || (select count(*) from _prisma_migrations)::text from audit_logs;")
$stagingSignature = Get-AtlasScalar -Lines $stagingLines -Pattern $SignaturePattern
$after = Get-LiveSignature

$log.Add("stagingAfter=$stagingSignature")
$log.Add("liveAfter=$after")
$log.Add("signaturesEqual=$($before -ceq $after)")
$log.Add("stagingMatchesLive=$($stagingSignature -ceq $after)")
$log.Add("finishedAtUtc=$((Get-Date).ToUniversalTime().ToString('o'))")
[System.IO.File]::WriteAllLines($logPath, $log)

$liveUnchanged = ($before -ceq $after)
$stagingMatches = ($stagingSignature -ceq $after)

[pscustomobject]@{
    result              = if ($liveUnchanged -and $stagingMatches) { 'SNAPSHOT_REFRESHED' } else { 'SNAPSHOT_INCOMPLETE' }
    stagingDatabase     = $StagingDatabase
    liveSignatureBefore = $before
    liveSignatureAfter  = $after
    stagingSignature    = $stagingSignature
    liveUnchanged       = $liveUnchanged
    stagingMatchesLive  = $stagingMatches
    archiveWrittenToDisk = $false
    logPath             = $logPath
} | ConvertTo-Json -Depth 4

if (-not $liveUnchanged) {
    Fail 'The live database signature changed during a staging snapshot. That must never happen. Evidence: ' + $logPath
}
if (-not $stagingMatches) {
    Fail "Staging signature '$stagingSignature' does not match live '$after'; the restore did not reproduce the database. Evidence: $logPath"
}
