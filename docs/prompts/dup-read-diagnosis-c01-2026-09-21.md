# DUP-READ-DIAGNOSIS-C01 — read-only diagnosis of the duplicate reads and the intermittent 502s

Status: **PREPARED — AUTHORIZED** under the operator's standing authorization
(`AGENTS.md` §13) for the program's work.

Risk: **LOW** — this packet changes **no source, no runtime, no data**. It is a read-only
investigation whose deliverable is evidence and a decision, not a patch.

Why no fix in this packet: the observed duplicate reads and the observed 502s **did not
correlate** in the only sample we have, and the candidate fixes have very different blast
radii — coalescing inside `atlasApi` would touch every API call in the client, while fixing
individual callers touches only those callers, and a server/proxy cause would touch neither.
Choosing before measuring would be guessing.

## 1. What is already known (do not re-derive)

From the `UX-R03d` and `UX-R03e` browser passes, both on the live build:

- Concurrent duplicate identical `/api/v1/` GETs occur on clean loads:
  `runtime/context?schoolId=1` ×4, `rollover-status` ×2-3, `auth/me` ×2.
- 502s were seen on clean loads of exactly two routes:
  `GET /api/v1/generation/1/10/runs/316/manual-edits` and
  `GET /api/v1/follow-up-flags/1/10/runs/316/flags`.
- In that sample the duplicates did **not** correlate with the 502s.
- The host is the production host on `5174`, proxying `/api/v1/*` to the server on `5001`.
  `/enrollpro-api/*` is a separate upstream and is healthy (the companion is back online).

## 2. Questions to answer, in order

1. **Which callers double-fetch?** For each duplicated endpoint, name the client call sites
   that issue it on a single page load, and say whether the duplication is (a) two distinct
   components each fetching, (b) one component fetching in two effects, (c) a
   StrictMode/dev-only double-invoke that would not occur in the production build, or
   (d) a retry/refresh path. **Establish (c) or rule it out early** — if the duplicates are a
   development artefact they are not a defect at all and the whole lead changes shape.
2. **Are the duplicates avoidable per caller?** For each, say whether a single owner (or a
   shared hook/query key) would remove it without changing behaviour, and how many files
   that would touch.
3. **What causes the 502s?** Reproduce them if you can, then decide from evidence which
   layer produces the 502: the client (aborting a request), the production host's proxy, or
   the server. Use the host log, the server log, and the response body — the proxy has
   previously returned a typed body (for example `UPSTREAM_UNREACHABLE`) and a bare 502 with
   no body would point somewhere else.
4. **Do the two findings interact at all?** With more samples than the two we have, state
   whether duplicates ever precede a 502 on the same endpoint, or whether they are
   independent.
5. **Recommend the fix** with its blast radius and its verification, and state explicitly
   which of these it is: coalesce in `atlasApi`; fix the named callers; fix the host proxy;
   fix a server route; or **no fix needed** because the cause is benign.

## 3. Boundaries — this packet authorizes no change

- No source, config, environment, task, release or runtime change. Do not edit any file
  except the one evidence artifact named in §5.
- **No browser.** Browser custody is serial and belongs to the current UX lane; this
  investigation must work from HTTP probes, the existing logs, and the source. If a
  conclusion genuinely requires a browser session, say so and stop rather than taking
  custody.
- Do not restart, stop or re-point the supervisor, its children, or ports 5001/5174/5175.
- No login, no database write (a read-only connection is fine), no migration, generation,
  publication, rollover, Teaching Load or term-cache action, and no companion edit.
- Never print or commit a secret or environment value.

## 4. Method

Read-only probes against the live host and the deployed release, plus source reading:
- count requests per endpoint on a clean page load without a browser if you can (for example
  by replaying the same request set with a script and comparing against the client's call
  sites), or otherwise derive the caller inventory from source and say which part is
  inference;
- read the host and server logs for the 502 window and for any repeated-request pattern;
- time the two 502 routes repeatedly to see whether they are slow, flaky, or failing only
  under a particular condition (cold start, concurrency, a specific query parameter).

State clearly which conclusions are **measured** and which are **inferred**, and give the
sample sizes.

## 5. Deliverable

One evidence artifact, `docs/reviews/dup-read-diagnosis-c01/findings.md`, committed on the
branch, containing: the caller inventory per duplicated endpoint with file:line; the
StrictMode/dev-versus-production determination; the 502 layer determination with the exact
evidence; the interaction answer with sample sizes; and the recommendation with its blast
radius and verification. One page. No transcripts, secrets or database rows.

Return a short handoff: base and candidate SHAs, the decisive commands with results, each
question's answer with `measured` or `inferred`, the recommendation, and any blocker.
