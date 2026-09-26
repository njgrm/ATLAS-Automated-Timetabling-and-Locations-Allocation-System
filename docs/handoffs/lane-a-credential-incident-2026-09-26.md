# Lane A — committed-credential incident, evidence and outcomes (2026-09-26)

**Status:** closed by mitigation. One item remains operator-owned (coordinated token rotation).
**Register:** `docs/plans/live-state.md` carries a condensed record; this file carries the evidence.
**Scope:** non-timetable. Lane A held only the credential item; timetable custody went to A2.

---

## 1. What was found

A PostgreSQL password for role `atlas_user` and a companion admin password were **hardcoded in tracked files while
the GitHub repository is Public**. Three claims in the register were unverified; three were wrong, one materially
dangerous.

The register asserted the exposed value "was not written to any file, commit, doc, or prompt". **That was false.**
Hashing every tracked file's DSN password against the live env value found **5 occurrences across 4 files**, in
history since `c12238cd0`. Evidence is a hash and a file:line list, never the value.

| File | Note |
| --- | --- |
| `atlas-server/.env.example:2` | the template new `.env` files are copied from — propagates by design |
| `atlas-server/diag.cjs:1` | added by `c12238cd0` |
| `atlas-server/src/scripts/assign-coverage-subjects.mjs:3` | |
| `atlas-server/src/scripts/verify-cross-repo-source-gate.ts:56,:57` | two DSNs |

`origin/main` is now clean of all four values; `CHANGELOG.md` still carries the separate `ATLAS_SYSTEM_TOKEN`.

## 2. Reachability, measured not assumed

- An unauthenticated fetch of the repository page rendered the **Public** badge.
- PostgreSQL listened on `0.0.0.0:5432` and `:::5432`, with firewall rule `Tailscale_Postgres_5432 = Allow`.
- `pg_hba.conf` ended with `host atlas_db atlas_user 100.64.0.0/10 scram-sha-256` — the Tailscale range.

Proven by connecting as an attacker would, with only the published password:
`100.88.55.125:5432 db=atlas_db` → **`CONNECTED as atlas_user to atlas_db`**.

**Blast radius, by exact `count(*)` over every user table (not the `n_live_tup` estimate):** `atlas_db` held **28
rows** — 27 `_prisma_migrations` + 1 `scheduling_policies` — with no faculty, subjects, auth accounts or audit rows.
The live database's 2,705 rows (incl. 45 `atlas_auth_accounts`, 424 `audit_logs`) were **not** covered by that grant.
`atlas_user` was not a superuser (`rolsuper`, `rolcreaterole`, `rolreplication`, `rolbypassrls` all false;
`rolcreatedb` true) though it owned all eight ATLAS databases, and ownership confers nothing without a CONNECT path.
**Conclusion: a credential-compromise incident, not a data breach.**

## 3. What the credential actually drives

Not a minor dev login. It is the single DB identity behind: the **live API server's** pool; **all eight ATLAS
databases as owner** (which is why Prisma migrations and its shadow-DB flow work); and the **server DB test gate**
— ~70 postgres-backed test files each `CREATE DATABASE … TEMPLATE …` a disposable DB from `DATABASE_URL`.
The whole harness reads the credential from the environment: `run-db-suite.mjs:109` (`process.env.DATABASE_URL`,
fail-closed if absent), every disposable test via `decodeURIComponent(source.username)`, and `prisma.config.ts:14`
via `env("DATABASE_URL")`. So the four hardcoded files were the only hardcoded consumers.

## 4. History purge: rejected, with reasons

`git filter-repo` would repoint every commit from `c12238cd0` to HEAD, so **every SHA pinned in the register and
handoffs dangles** — the whole `AGENTS.md` §10–§11 range-review evidence chain. Three active lanes hold 19 E: and
12 D: worktrees and 13 branch tips already had absent/behind remote refs, so a force-push leaves every lane
diverged — the exact "candidate the integration boundary has never seen" defect §10 rule 12 records as having
already happened. The public repo has 1 open PR, which it would break. And security value is marginal: assume the
value is already scraped, so a purge cannot unpublished it; it only prevents future reuse of a string rotation
already kills. **History was left intact deliberately.**

## 5. Self-inflicted outage during the first rotation attempt

The intended order was `ALTER ROLE` → env write → quiesce → `schtasks /run`. The `ALTER ROLE` **succeeded**; the
env write was **denied**; the script threw; the new value existed only in the exited process's memory. Half-state:
role = NEW, env = OLD, new value unrecoverable. Impact: `/health/ready` **503**, subjects **500**, and
`FATAL: password authentication failed for user "atlas_user"`.

Recovered via `pg_hba.conf` (no superuser credential exists anywhere): temporary `trust` rules → restart
`postgresql-x64-18` → `ALTER ROLE` back using the **untouched** env file → restore `pg_hba.conf` → restart.
Verified: original password authenticates; `pg_hba.conf` **byte-identical** (5728 bytes, `Compare-Object` clean);
no `trust` residue; all seven rules back to `scram-sha-256`; ready 200 `database:"ok"`; subjects 200; Tailnet 200;
**ATLAS listener PIDs unchanged throughout** (23520/23544) so ATLAS never restarted. **Net data change: none.**

**Root cause, and the two rules it earned.** I split an operation atomic in effect across a permission boundary
and **did not verify the second write before performing the first**. The new password was also never persisted
retrievably before rotating.
1. **Prove every write in a multi-write change before performing any of them.** A permission probe is cheap; an
   outage is not.
2. **Persist a new secret somewhere retrievable before rotating**, never only in process memory.

## 6. Mitigations applied

**Mitigation 1 — the Tailnet grant is gone; PostgreSQL is loopback-only.** The line was **commented out, not
deleted**, with a dated in-file note giving the reason, the measured content, and the original line for
reversibility. No restart needed. Proven both ways: before → `CONNECTED`; after → `FATAL: no pg_hba.conf entry for
host "100.88.55.125"`. No collateral damage: every live session was already loopback, `DATABASE_URL` is
`localhost:5432`, and no tracked file uses the Tailnet address for Postgres.

**Mitigation 2 — the `atlas_user` password is rotated.** The **old published value now fails authentication**.
Sequence, in three separable stages, each verified before the next:

1. **Probe first.** Found the live env file is **deliberately read-only**: an explicit, non-inherited ACL granting
   only `Read, Synchronize` to SYSTEM, Administrators and the owner — *not* FullControl even for Administrators.
   Elevation cannot write it, so the probe **stopped the rotation before any credential changed**. Un-hardening the
   file is a security decision, so it was escalated to the operator, who chose option A (temporary grant, rotate,
   restore).
2. **Capture, back up, generate, persist, write — all non-disruptive.** SDDL captured for exact restoration; both
   env files backed up byte-exactly; a 44-char base64url password generated and **written to disk before use**.
   Both files rewritten by byte-level substitution only, each reporting a delta of exactly `+32` — the
   password-length difference, proving nothing else moved. State then: env = NEW, role = OLD, running server = OLD,
   so traffic was unaffected; confirmed live before proceeding.
3. **The window, ~20 s, rollback armed.** `ALTER ROLE` → `taskkill /T /F` the supervisor tree (PID 32924) → wait for
   5001/5174 to release → `schtasks /run`. The script would have rolled the role and both env files back and
   re-started the task had the ports not cleared.

Post-rotation, all executed: new password authenticates; old published password returns `FATAL`; health 200;
ready 200 `database:"ok"`; subjects 200; Tailnet 200. Fresh PIDs (5001 → 32400, 5174 → 26472, supervisor → 24704).

**The ACL hardening is restored byte-identically.** The captured SDDL was re-applied and compared
(`O:BAG:…D:PAI(A;;FR;;;SY)(A;;FR;;;BA)(A;;FR;;;…)` before and after, **IDENTICAL: True**); a real write was then
attempted and **denied**, so the restriction is proven rather than assumed. Staged password and backups deleted.

## 7. The committed-credential class, closed and gated

`fix/committed-credential-scrub-20260926`, 5 commits `4775381a → 5023aad0 → 10abbd38 → dcb98ce6 → d330870a`,
merged to `main` as `253d2dff`. Removed: the 4 original sites, a live credential in `local-auth.service.ts` (the
login path), a password printed in a seed log, `bcrypt.hash()` literals in `prisma/seed.js` feeding real seeded
accounts, the Playwright spec fallback, a bearer token, the README login instructions, and stray `.txt` artifacts.

Each round was stopped by review for falsifying a premise rather than forcing green. Three findings that mattered:

- **The first guard was blind to the shapes actually in the repo** (`bcrypt.hash('literal')`, markdown
  email/credential pairs, `||`/`??` fallbacks, quoted JSON keys, comment lines). A green guard that cannot see the
  defect it exists to prevent is theatre.
- **My own triage missed the same credential in other files** because it asked whether those *sites* held live
  credentials instead of whether those *credentials* existed elsewhere. Convergence is now measured by
  byte-identity against every removed value.
- **A leading UTF-8 BOM defeated the position-anchored rules** — proven with a controlled pair differing only in
  the first three bytes, and fixed in the read helper.

Final state: **convergence 0** by an independent scan with the executor's own patterns; guard **13/13**, reachable
from `test:committed-credential-scrub` and the `test:server-suite` aggregate; `gate-reachability` green; every rule
proven RED-then-GREEN on planted samples; auth proven not permissivised (`compare(correct)=true`,
`compare(wrong)=false`, `compare("")=false`; `bcrypt.hash(undefined)` throws).

**Integration gates on the merged tree:** `tsc --noEmit` exit 0 and `npm run build` exit 0 — **after
`prisma generate`**, since a fresh worktree has no generated client and its absence masquerades as a type error
in unrelated files. `git diff --check` clean. Server suite **354 tests, 350 pass, 4 fail**, all four in
`tt-output-c03r.test.ts` and **proven not mine**: that test and its whole import closure are byte-identical between
the merge base and the result, and absent from the merge's 18 changed paths.

A second lane pushed `7c295e62` mid-integration. Caught by fetching before pushing, re-merged (disjoint: one new
handoff doc), gates re-run green, then pushed `7c295e62..253d2dff`. **All four formerly-public values now read 0
files on the public `origin/main`; the other lane's handoff is preserved.**

## 8. Open and operator-owned

1. **`ATLAS_SYSTEM_TOKEN` is not rotated.** ATLAS validates it against what EnrollPro presents, EnrollPro's copy
   lives on `dev-jegs`, and §4 makes that companion read-only. Rotating breaks the integration until its owner
   updates their side. **Coordinated operator action.**
2. **`CHANGELOG.md`** carries that same live token (pre-existing; hash-confirmed identical). Scrub and rotate with #1.
3. **`D:\ATLAS\EnrollPro\server\.env`** held the old DB password and will stop authenticating. **Operator-only** (§4).
4. **History retains every removed value** at `a1dcfc34` and earlier. This is the accepted, deliberate residual.

## 9. Lessons that outlive this incident

- **A single free-space sample is not a measurement.** A first `Get-PSDrive D` read 20.3 GiB — below the §3 warning,
  on the PostgreSQL volume — and the same volume read 39.46 GiB a minute later and stayed there across six samples.
  Recording the first reading would have seeded a fabricated capacity emergency. Sample a volume repeatedly, and
  separate ATLAS's consumption from the host's: `SteamLibrary` alone was 69.88 GiB, so ATLAS was not the lever.
- **A suspiciously uniform result is a bug signature.** `origin/main..$b` inlined in PowerShell expands `$b..origin`
  ambiguously and returned `ahead=0 behind=0` for every branch, including ones at visibly different SHAs. The real
  answer (`ahead=0` for all 13 non-release tips — the property that actually matters) only appeared after building
  the range as a quoted string and checking `$LASTEXITCODE`.
- **Grep, do not assume, when checking another lane's records.** The same ten E: worktrees had been credited with
  invented dispositions once already; a per-name occurrence count in this file settled it (0 each).
- **A subagent's finding can out-run your own measurement.** The executor reported nine extra credential sites; my
  check called the five `README.md` ones leaks, and they were `your_password` placeholders — a defect in my guard's
  classification, not in the README. It also reported three app logins my own regex missed because I anchored on
  uppercase names while the files use lowercase `password:` properties.
- **Own the disclosures.** Two credentials reached this session's transcript — the DB password through reading files
  to edit them, and the live `ATLAS_SYSTEM_TOKEN` through a `H` → `Get-History` alias collision that dumped it in an
  error message. Both were already public, so no new exposure, but the second was a redaction rule broken by a
  one-letter function name while enforcing that same rule.
