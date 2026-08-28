# Defense Question And Answer Alignment Audit - 2026-05-27

## Purpose

This audit verifies whether the sample defense questions and targeted answers in [question_prompt.pdf](/d:/ATLAS/question_prompt.pdf) accurately match:

- the current repository implementation
- the current runtime documentation
- the current projected direction of the system

This is a defense-prep document, not an implementation spec.

## Sources Used

- [docs/reference/atlas-runtime-source-of-truth-map.md](/d:/ATLAS/docs/reference/atlas-runtime-source-of-truth-map.md)
- [docs/SYSTEM-OVERVIEW.md](/d:/ATLAS/docs/SYSTEM-OVERVIEW.md)
- [docs/analysis/phase3-paper-alignment-audit-2026-05-24.md](/d:/ATLAS/docs/analysis/phase3-paper-alignment-audit-2026-05-24.md)
- [phasePlan.md](/d:/ATLAS/phasePlan.md)
- [prisma/schema.prisma](/d:/ATLAS/prisma/schema.prisma)
- [atlas-server/src/services/generation.service.ts](/d:/ATLAS/atlas-server/src/services/generation.service.ts:829)
- [atlas-server/src/services/hybrid-scheduler.ts](/d:/ATLAS/atlas-server/src/services/hybrid-scheduler.ts:1)
- [atlas-server/src/services/constraint-validator.ts](/d:/ATLAS/atlas-server/src/services/constraint-validator.ts:223)
- [atlas-server/src/services/local-auth.service.ts](/d:/ATLAS/atlas-server/src/services/local-auth.service.ts:1)
- [atlas-client/public/sw.js](/d:/ATLAS/atlas-client/public/sw.js:1)
- [atlas-client/src/main.tsx](/d:/ATLAS/atlas-client/src/main.tsx:1)

## Executive Verdict

The sample defense set is usable, but several answers are too absolute.

The biggest corrections are:

1. The algorithm answer should describe ATLAS as a **hybrid multi-seed greedy + repair + fitness-scored scheduler** in current code, not a clean "GA solves everything" story.
2. The timetable answer must **not** claim the system is already consistently conflict-free or publish-ready in live operation.
3. The offline answer must **not** describe ATLAS as fully offline-first across the whole product.
4. The database answer should say the current implementation has **29 Prisma models**, not 28.
5. The auth answer should say students are **public unauthenticated viewers**, not authenticated role-holders inside the same app.

## Recommended Answer Set

### Category 1: Algorithmic Engine And Optimization

#### Q1. "Since academic timetabling is an NP-hard problem, how exactly does your Hybrid Algorithm navigate the constraint space without crashing?"

**Verdict:** Mostly accurate, but should be tightened.

**Why:**

- Current code really does invoke a hybrid path through `runHybridScheduler(...)`.
- The hybrid scheduler uses deterministic greedy seeds, quality scoring, and bounded repair operators.
- The answer should avoid implying that the system has already solved all live feasibility blockers.

**Defense-safe corrected answer:**

> Academic timetabling is NP-hard because the search space grows combinatorially when you mix sections, teachers, rooms, periods, and policy rules. In ATLAS, we avoid exhaustive search by first generating several deterministic greedy baseline schedules quickly, then ranking and refining them through a hybrid scheduler that applies fitness-style scoring and bounded repair passes. In other words, the system narrows the search space early, then improves candidate schedules instead of brute-forcing every possible arrangement. That is why it remains computationally practical even though the full problem is mathematically hard.

#### Q2. "Why use a Hybrid Greedy-Genetic Algorithm? Why not just use Tabu Search or Particle Swarm Optimization (PSO), which are standard in literature?"

**Verdict:** Acceptable as design rationale, but not as benchmark proof.

**Why:**

- The repo does not show a comparative benchmark against Tabu Search or PSO.
- The rationale about discrete constraints is still reasonable.

**Defense-safe corrected answer:**

> We selected a hybrid deterministic-constructor approach because our scheduling data is discrete and heavily rule-bound. A greedy constructor gives us fast feasible seeds, and the optimizer layer improves them without restarting from scratch. Tabu Search and PSO are valid literature options, but in our case we preferred an approach that is easier to keep deterministic, easier to repair when hard conflicts appear, and more natural for section-teacher-room placement data than a purely continuous swarm-style search. So the choice is a practical architecture decision for our domain, not a claim that the other methods are invalid.

#### Q3. "How do you mathematically distinguish a Hard Constraint from a Soft Constraint in your backend code?"

**Verdict:** Mostly accurate.

**Why:**

- Hard constraints are explicitly validated in the constraint validator.
- Soft constraints and warnings exist through severity classification, policy configuration, and hybrid scoring.
- The TLE workshop example is no longer ideal because TLE contract assumptions changed; room-type mismatch is still a valid generic example.

**Defense-safe corrected answer:**

> In ATLAS, hard constraints are the rules that cannot be violated without making a schedule invalid, such as teacher double-bookings, room double-bookings, subject-room incompatibility, or assigning an unqualified teacher. Those are validated explicitly as hard violations. Soft constraints are optimization goals such as travel burden, idle gaps, or preference alignment. Those do not automatically invalidate a draft, but they lower its quality score or appear as warnings. So mathematically, hard constraints define feasibility, while soft constraints define quality among feasible or near-feasible candidates.

#### Q4. "What happens if the inputs are physically impossible? For example, if there are 30 sections but only 10 available physical classrooms?"

**Verdict:** Partially accurate, but overstated.

**Why:**

- The system does detect and report blockers.
- Current live behavior is better described as surfacing explicit violations, shortages, and unassigned items, not simply "halts with one exact message."
- `TC-08` is manuscript-dependent and not repo-verifiable here.

**Defense-safe corrected answer:**

> If the input data is physically infeasible, ATLAS does not silently fabricate a fake timetable. Instead, it surfaces the infeasibility through generation diagnostics such as unassigned sections, specialized-room shortages, or policy-blocked placements. In other words, the system degrades into a reportable constraint-failure state rather than pretending that an impossible schedule is valid. If your manuscript already documents this as a specific test case, you can cite that test case there, but in the defense answer itself it is safer to emphasize the runtime behavior: detect, report, and preserve auditability.

#### Q5. "If your system is a 'Decision-Support Web Application', why do you need a manual drag-and-drop refinement interface if the algorithm is supposed to be automated?"

**Verdict:** Correct direction, but "mathematically perfect baseline" should be removed.

**Defense-safe corrected answer:**

> The automated engine gives the scheduler a strong first draft, but school scheduling still contains human exceptions that are difficult to encode exhaustively, such as last-minute staffing decisions, administrator overrides, and special operational preferences. The manual refinement layer exists because ATLAS is a decision-support system, not a black-box autopilot. Automation reduces the search burden, while the scheduler retains final control over approved placements.

### Category 2: Database Architecture And Integrity

#### Q6. "Your system utilizes a 28-table architecture. Why does an academic scheduling tool require so many tables?"

**Verdict:** Currently inaccurate on the count.

**Why:**

- The current Prisma schema defines **29 models**, not 28.
- The structural explanation is still good.

**Defense-safe corrected answer:**

> The current implementation is closer to a 29-model schema, not 28, because the system separates operational concerns instead of overloading one giant timetable table. We persist distinct structures for mirrored upstream data, scheduling policies, generation runs, manual edits, locks, preferences, class templates, ownership mappings, and audit trails. That normalization reduces duplication, improves traceability, and makes it possible to explain why a schedule looks the way it does at a given moment.

#### Q7. "What are your 'Teacher Mirrors' (teacher_mirrors) and 'Section Mirrors' (section_mirrors) tables? Why are they called mirrors?"

**Verdict:** Needs naming correction.

**Why:**

- Actual model/table names are `faculty_mirrors` and `section_mirrors`.
- They are mirrors of external roster data, but not strictly only "DepEd LIS."

**Defense-safe corrected answer:**

> In the current schema they are called `faculty_mirrors` and `section_mirrors`. They are called mirrors because they store local scheduling copies of upstream roster data rather than being the original source system themselves. This lets ATLAS keep a stable scheduling dataset even when the upstream integration is slow or temporarily unavailable, while still preserving the idea that the source system remains authoritative for roster-origin data.

#### Q8. "How does the database handle the 'Locked Sessions' (locked_sessions) feature during manual refinement?"

**Verdict:** Mostly accurate, but should be scoped more carefully.

**Why:**

- `locked_sessions` is real.
- It is best described as a **pre-generation lock / draft constraint** mechanism, not a vague universal pin for every possible post-review action.

**Defense-safe corrected answer:**

> ATLAS stores locked draft placements in the `locked_sessions` table. These represent scheduler-approved placements that should be preserved during subsequent automated generation passes. Functionally, that means the generator treats those rows as fixed draft constraints so that regeneration does not casually overwrite a placement the scheduler intentionally preserved.

#### Q9. "How do you secure teacher data, specifically regarding passwords and permission elevations?"

**Verdict:** Mostly accurate, but role phrasing should be corrected.

**Why:**

- Password hashing with `bcryptjs` is real.
- JWT-based session tokens are real.
- Privileged roles include `admin`, `officer`, and `SYSTEM_ADMIN`.
- Students are public viewers, not a normal authenticated teacher-like role in the same flow.

**Defense-safe corrected answer:**

> ATLAS hashes account passwords with bcrypt and issues JWT-based authenticated sessions. The system separates access by role, primarily distinguishing privileged scheduler or admin users from faculty users, while student schedule viewing is handled as a public unauthenticated read-only experience. That structure reduces unnecessary privilege exposure and keeps administrative scheduling actions behind authenticated role checks.

### Category 3: Infrastructure, Caching, And Connectivity

#### Q10. "Explain exactly how A.T.L.A.S. functions as an 'online-first but offline-capable' application."

**Verdict:** Overstated as written.

**Why:**

- ATLAS now has partial service-worker and cached-read behavior.
- Some queued or degraded flows exist.
- It is still not honest to describe the whole product as fully offline-first.

**Defense-safe corrected answer:**

> ATLAS is best described as online-first with selective offline-capable behaviors, not as a fully offline-first platform. Core scheduling data still works best when the ATLAS server is reachable, especially for writes and high-dependency workflows. However, the system now supports cached reads and some degraded or queued behaviors so that users do not immediately lose all context during a connection interruption. So the practical value proposition is graceful degradation, not complete offline parity across every module.

#### Q11. "How does 'smart client-side caching' work when a student or teacher goes completely offline outside the school network?"

**Verdict:** Partially accurate.

**Why:**

- Selective caching exists.
- Published schedule and some faculty/scheduler views can reopen from cached state.
- The answer should avoid implying universal cache coverage for the whole product.

**Defense-safe corrected answer:**

> ATLAS uses selective client-side caching so that some previously loaded views can reopen from last-known local data instead of immediately failing hard. In practice, this is strongest for specific published or faculty-facing reads and certain scheduler snapshots, not every page in the system. So if a user goes offline, the application can often fall back to the last known safe state for supported workflows while clearly indicating that the data is cached rather than live.

#### Q12. "How does 'automatic background synchronization' function when the network returns?"

**Verdict:** Too broad.

**Why:**

- Queued or deferred sync exists for specific workflows such as room-preference and some outbox-like operations.
- It is not accurate to say all administrative adjustments everywhere automatically sync back.

**Defense-safe corrected answer:**

> ATLAS currently supports deferred synchronization only for selected workflows, not as a universal background-sync guarantee for every page. Where queue-backed behavior exists, local changes are preserved and later pushed once connectivity returns. For the defense, the safest phrasing is that ATLAS supports workflow-specific deferred sync and cached recovery, rather than claiming a complete app-wide offline writeback engine.

#### Q13. "Why did your group select a localized, self-hosted on-premises deployment instead of standard cloud hosting like AWS or a VPS?"

**Verdict:** Valid architectural rationale, but not purely code-verifiable.

**Why:**

- Project docs do align with a LAN-first or local institutional deployment mindset.
- The exact Ubuntu wording is a deployment choice, not something proven by code alone.

**Defense-safe corrected answer:**

> Our preferred deployment model is school-controlled hosting because it better matches the network reality and governance requirements of a public-school scheduling environment. A localized or institution-managed deployment reduces dependence on continuous public internet access and keeps operational data under the school's administrative control. The exact infrastructure stack, such as Ubuntu or another server environment, is an implementation choice, but the strategic reason is control, resilience, and lower recurring platform cost.

### Category 4: Research Methodology And Evaluation Standards

These items are **manuscript-dependent**, not fully code-verifiable from the repository alone.

If your manuscript truly documents them, the answers are generally usable.

#### Q14. Descriptive + Developmental Research Design

**Verdict:** Reasonable.

**Safer answer:**

> The descriptive phase established the real scheduling problems, institutional practices, and stakeholder constraints. The developmental phase used that evidence to design, build, and evaluate the ATLAS intervention. So the descriptive part defines the problem context, while the developmental part defines the solution process.

#### Q15. Qualitative requirements gathering vs quantitative evaluation

**Verdict:** Reasonable.

**Safer answer:**

> There is no conflict because the project uses different methods at different stages. Qualitative methods help capture scheduling pain points and operational behavior, while quantitative evaluation helps measure whether the built system performs acceptably against the chosen criteria.

#### Q16. AAA in the test case questionnaire

**Verdict:** Reasonable if your written test cases really follow it.

**Safer answer:**

> The AAA framing means each test case is structured around preparation, execution, and verification. We define the input and environment first, run the action second, and then check whether the observed result matches the expected outcome, including both valid and invalid scenarios.

#### Q17. Likert + ISO/IEC 25010 interpretation

**Verdict:** Reasonable if your evaluation instrument is really organized that way.

**Safer answer:**

> The Likert responses should be aggregated first at the sub-characteristic level so we can identify where the system is strong or weak in measurable terms. After that, the sub-scores can be summarized into broader ISO/IEC 25010 quality characteristics to support an evidence-based readiness discussion.

## Final Defense Guidance

### Safe claims

- ATLAS is a real multi-page scheduler platform.
- The admin portal, faculty mirror sync, preferences, generation runs, policy records, locks, manual edits, and audit structures are real.
- The system uses a hybrid scheduling path in current code, combining deterministic construction, scoring, and repair.
- The system preserves explicit diagnostics when scheduling inputs are infeasible.

### Claims to soften

- "conflict-free timetable" -> say "goal" or "target state," not guaranteed current live truth
- "offline-capable" -> say "selective cached and deferred-sync behaviors," not full offline parity
- "28-table architecture" -> correct to current implementation count
- "student authenticated role" -> correct to public unauthenticated viewer
- "mathematically perfect baseline" -> replace with "strong draft baseline" or "best candidate draft"

### Best single-sentence summary

> ATLAS is already a real scheduling product with hybrid generation, policy-aware validation, manual refinement, and synchronized roster mirrors, but it should still be defended as a system that surfaces and manages scheduling complexity honestly rather than as one that has already solved every live deployment edge case.
