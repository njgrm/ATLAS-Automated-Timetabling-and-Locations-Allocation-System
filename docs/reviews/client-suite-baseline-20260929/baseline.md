# test:client-suite baseline, 2026-09-29 06:10 (Lane C)

The script was malformed (`tsx --test tsx --test`) and had run on nothing for an unknown period. Fixed in the commit that adds this file.

- Live (train 5, ce1257c8): 1220 tests, 1182 pass, **38 fail**. These are the KNOWN_RED baseline listed below.
- main 9f8028e2: 1181 pass, 39 fail. The **one new** failure is the B5 1000-line cap. `pages/Audit.tsx` reached 1003 lines at A3 ac8adf09 and is routed to A3.
- Rule for train 6 onward: a train may not add any failure to this list. A4 compares `✖` lines against it.

```
✖ "All terms" disables official beneficiary downloads and explains why
✖ #51 a published run on the Expert surface renders no "Draft" anywhere in its state chrome
✖ #59/#17 the drift claim is shown only when the comparison is trustworthy about THIS run
✖ A2-5 item 5: every guarded action and testid survived the layout change
✖ A2-5 item 5: no action button is allowed to squeeze the message at 390px
✖ A2-5 item 5: the message takes its own line below sm, so the actions wrap instead of squeezing it
✖ A2-5 item 5: the regeneration guard is byte-for-byte the pre-change contract
✖ A8 control: only entries in the active review set carry a warning marker
✖ B-10 both Simple and Advanced surface the checked-at age
✖ B4 the client code predicate agrees with the server allowlist for every policy-pane code
✖ B7/#59 the neutral note names the timing, and a GENUINE stale comparison still alarms
✖ C01R C3 the header renders one status surface owning drift, day options, and the next step
✖ C01R boundaries: scope hygiene, term identity, actor scope, and the strict predicate survive
✖ C04 both sync success toasts state the exact retained reviewed-assignment count
✖ C2-a.7 the blocked state keeps the ≤6 visible-control cap and exactly one solid primary
✖ D5 a stale availability change renders its chip and the explicit regenerate action
✖ D5 the Simple drift surface renders the explicit regenerate affordance with its published guard
✖ F2 the client blocking behavior matches the server promotable allowlist
✖ F2 the header routes the publish task to that surface through the shared dispatcher
✖ F4 loose-predicate mutant: retained markers alone never hide the sync route
✖ F4 published drift routes to revision guidance and exposes no sync action
✖ F4 the banner gates sync on the published prop
✖ F4 unpublished drift keeps the canonical sync route
✖ PL-J4.3 a drift we could not CHECK is not styled as a confirmed drift, and the wording says so
✖ PL-J4.3R (A2-C6-TRUTH T3e) the drift banner states its fact in twelve words or fewer
✖ R1 the Temporary substitutes chip is a real, enabled control
✖ R5 a scope change clears sheets, task, selection, and swap state
✖ R6 Simple renders the shared drift banner and rollover authority surface
✖ R7 setup-sync impact review is reachable from Simple
✖ R9/A-15 Advanced blocks publish for an already-published run
✖ UX-R03b row 8: lifecycle drift actions preserve published and draft confirmation gates
✖ UX-R03e setup row 2: the pane renders the drift banner directly with no second sync handler
✖ UX-R03e setup: every touched component file stays under the 1000-line cap
✖ every beneficiary export binds the selected term into its real request URL and filename
✖ failing tests:
✖ readiness chip keeps blockers first and stays honest when clean
✖ src\components\__tests__\a7-year-setup-plain-words.test.tsx
✖ the production grid and Simple header consume these exact term/export controls
✖ the section-view cell no longer hides the teacher and the hook no longer emits loading placeholders
```
