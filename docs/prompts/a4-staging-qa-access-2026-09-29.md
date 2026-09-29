# A4 small packet — planners can render REAL staging data (operator, 12:25)

Issued by Lane C. ELEVATED (:4097). Fresh session. Short job; end when done. Operator direction: planners must see
real data, not fixtures; we are short on time.

Lane C already created a STAGING-ONLY QA login with `scripts/dev/ensure-staging-qa-account.cjs` (refuses any database
but loopback `atlas_staging`; password only in `D:\ATLAS-runtime-config\atlas-staging-qa.env`, never printed;
verified absent on live). Login returns 200 officer on `:5101`. What is missing:

1. **CORS for previews.** `D:\ATLAS-runtime-config\atlas-staging.env` is write-protected for non-elevated users.
   Back it up to `D:\ATLAS-runtime-config\backups\`, then append to `CORS_EXTRA_ORIGINS` the origins
   `http://127.0.0.1:5200`..`http://127.0.0.1:5299` and `http://localhost:5200`..`http://localhost:5299`
   (comma-separated, exact match — app.ts:75-92). **Staging env only; never the live env.**
2. Restart the staging API only (5101) so it re-reads the env; live 5001/5174 untouched (measure PIDs before/after).
   Prove: `curl -H "Origin: http://127.0.0.1:5290" http://127.0.0.1:5101/api/v1/health` returns 200.
3. **Every staging deploy from now on** (train 9 onwards): after the DB re-stream, run
   `node scripts/dev/ensure-staging-qa-account.cjs` and record `STAGING QA ACCOUNT READY`. Add that line to the
   staging steps in the train packet template and AGENTS.md §14 in one docs commit.
4. Post one line in `docs/handoffs/lane-c-to-a2.md`: `A4 staging QA access READY` with the curl proof. END.

Shell calls are force-killed at 20 min. Stop only processes you started (the staging API child by its PID).
