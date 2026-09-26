# Lifecycle model — live contradiction inventory across the four surfaces

Date: 2026-09-26 (Asia/Manila) · Lane: A2 · Harness: authenticated Tailnet session, deployed release
`26f7c907` · Mutating actions: **none** (page reads only) · Verdict: **diagnosis CONFIRMED, with one finding
the handoff did not record and one upstream dependency that blocks the fix.**

## What each surface actually says, measured

Walked in one session, same moment, no interaction beyond reading. Order matters: the pages were read in
sequence and each claim is quoted from rendered text.

| Surface | Route | Lifecycle words rendered | Term shown |
| --- | --- | --- | --- |
| Dashboard | `/` | **"Schedule published"**, **"Published schedule is live"** | S.Y. 2031-2032 ACTIVE (no term) |
| Timetable | `/timetable` | **"Draft"** | — |
| Teacher portal | `/my` | bare **"Live"** *and* "draft ready" *and* "Draft schedules may still change." | **Term: T2** |
| Public schedule | `/public/schedules` | **"PUBLISHED TIMETABLE"**, **"Live publish"**, "40 published classes are shown." | **TERM 1** |

## The underlying facts, from the database (read-only)

```
generation_runs            314,315,316,317,318 — all COMPLETED, all school_year_id 10
enrollpro_school_year_mirrors  551 | epYear 10 | 2031-2032 | active | term_contract_cache POPULATED
                                 orderedTerms T1#1 T2#2 T3#3   activeTerm = T1 (order 1)
```

The live state is therefore exactly the contested case: **run 317 is published (revision 43) and run 318 is
a newer completed draft awaiting review.** Both statements the surfaces make are individually true, and
together they are unreadable.

## Three defects, not one

**D1 — The surfaces each show one half and neither names the other.** The dashboard says the schedule is
published and live; the timetable says the thing in front of you is a Draft. Neither mentions that a
published schedule *and* a newer draft both exist. A scheduler cannot tell whether the draft is a candidate
to publish or the thing the live claim refers to.

**D2 — `/my` carries an unattributed bare "Live".** The teacher portal renders the word "Live" next to
"draft ready" and "Draft schedules may still change." with nothing saying *which* schedule is live. This is
precisely the handoff's prohibition — **do not infer "Live" from the existence of a row** — reproduced
verbatim. A teacher reading this page cannot answer "is my schedule published?".

**D3 — THE SURFACES DISAGREE ABOUT WHICH TERM IS CURRENT. This is new; the handoff did not record it.**

| Source | Term |
| --- | --- |
| `/my` (teacher portal) | **T2** |
| `/public/schedules` (public) | **TERM 1** |
| Persisted mirror cache | `activeTerm` = **T1**, ordered T1/T2/T3 |
| Live-first resolution | T2 (which is what `/my` is showing) |

**The public schedule and the teacher portal state different current terms on the same deployment.** The
public page is serving the stale persisted value while `/my` is serving the live-resolved one. This is the
same stale-cache-vs-live-first split recorded against the active-term work, now visible as a
**cross-surface contradiction on a public-facing page** rather than an internal diagnostic. It is also the
handoff's finding 3 ("the public schedule previously rendered Term 1 while the school's active term is T2"),
still live, and now with the conflicting pair identified.

## The sequencing consequence — D3 is upstream of the lifecycle model

The handoff requires the shared model to distinguish "a published schedule: publication date **and the
term it represents**". That is not writable while the surfaces disagree about which term is current. A model
that said "published, Term 1" on the public page and "Term 2" on `/my` would satisfy the letter of the
requirement and reproduce the defect in a new place.

So the honest order is:

1. **Close the term-authority disagreement first** (D3), or at minimum decide which source the public
   surface must serve. This is the same cache that the handoff's finding 3 concerns and that the
   active-term live-first work touches.
2. **Then** build the one shared lifecycle model, whose `published.termLabel` is only trustworthy once (1)
   is settled.
3. Draft rows not being labelled Live (D2) is **independent** of D3 and can land first if the operator
   prefers visible progress.

## What the shared model must be, when it is built

One module, one pure derivation, four consumers. Required states, from the handoff plus what D3 adds:

| State | Meaning | Required in the statement |
| --- | --- | --- |
| `UNVERIFIED` | facts insufficient | **say the uncertainty**; never assert a completed publication |
| `NO_PUBLISHED_SCHEDULE` | nothing published | distinguish from "not yet generated" |
| `DRAFT_ONLY` | generated, never published | the draft's run and term; not Live |
| `PUBLISHED_ONLY` | published, nothing newer | publication date, the term it represents, audience |
| `PUBLISHED_WITH_NEWER_DRAFT` | the live contested case | **both**, each labelled, and which one this surface is showing |

`UNVERIFIED` is not decorative: it is the state the handoff asks for when a term or revision cannot be
proven, and it is the state a surface must reach rather than guessing.

## Evidence discipline

Every row above is a rendered-text capture from one session on one deployment, and every database figure is
a read-only `SELECT`. **The one thing this does not establish** is what any surface looks like *after* a fix,
because the candidate is not deployed — live browser evidence cannot prove undeployed source bytes. Rows
requiring the built surface remain UNPERFORMED and are labelled as deployment-acceptance clauses.
