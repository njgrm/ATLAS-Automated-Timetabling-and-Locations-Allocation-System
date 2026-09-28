VERDICT: CORRECTION_REQUIRED
G1 FAIL - ports 5001/5174 are listening on PIDs 3516/60116 and machine runtime source is clean at 7590d485974337f834aa3972bb128090e6067b8d, but the required literal GETs /health and /health/ready both return 404 (the documented /api/v1 equivalents return 200).
G2 FAIL - 5101 and 5274 listen; 5274 returns 200, documented /api/v1/health and /api/v1/health/ready return 200, and a staging DB-backed GET returns 200; but the required literal 5101 /health and /health/ready both return 404.
G3 PASS - live/staging env key-name sets match; staging DATABASE_URL database is atlas_staging and differs from live; PORT is 5101 versus live 5001; JWT_SECRET SHA-256 comparison differs; final ACL SDDL matches and icacls principals match (BUILTIN\\Administrators, LAPTOP-6K65A1QI\\njgro).
G4 FAIL - pg_dump -Fc is streamed to pg_restore with the archive as stdin and failures stop; however unbounded override parameters can target live-owned task, release-root, or env paths. The script also writes ENROLLPRO_PROXY_ORIGIN's value to deploy stdout.
G5 FAIL - independent task verification is unavailable: schtasks /query /tn \ATLAS-Runtime-Supervisor /v /fo list and \ATLAS-Staging-Supervisor both returned Access is denied (exit 1), so distinct registration and ONSTART trigger cannot be proved.
G6 PASS - the range adds staging operations/configuration only; no added HTTP companion client or EnrollPro/SMART/AIMS write call was found.
BLOCKING: ops/staging/deploy-staging.ps1:44,305-306,384 - -TaskName has no deny-list/equality guard; passing ATLAS-Runtime-Supervisor would stop and then overwrite the live task.
BLOCKING: ops/staging/deploy-staging.ps1:43,46,335,379-380 - -ReleaseRoot and -StagingEnvFile are unrestricted; a live release root or live env path can be supplied and written.
BLOCKING: ops/staging/deploy-staging.ps1:290 - deploy output interpolates VITE_ENROLLPRO_URL/ENROLLPRO_PROXY_ORIGIN value instead of reporting its key name only.
