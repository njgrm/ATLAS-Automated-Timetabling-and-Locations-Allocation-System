# Architecture Decision Log (ADR)

Use this file to capture non-trivial technical or policy decisions.

## ADR Template
### ADR-XXXX: [Title]
- Date: YYYY-MM-DD
- Status: Proposed | Accepted | Superseded
- Context:
  - [What problem are we solving?]
- Decision:
  - [Chosen approach]
- Consequences:
  - [Trade-offs, risks, follow-up work]
- Links:
  - [PRs, docs, evidence, issues]

---

### ADR-2026-03-31: Multi-file Phase Governance
- Date: 2026-03-31
- Status: Accepted
- Context:
  - Single-file planning created drift between active phase pointer and detailed execution state.
- Decision:
  - Keep `phasePlan.md` as top-level phase pointer and move detailed execution/verification into structured docs under `docs/phases` and `docs/verification`.
- Consequences:
  - Better traceability and reduced planning ambiguity.
  ---

### ADR-2026-05-12: Dynamic Specialization Mapping and Tiered Qualification
- Date: 2026-05-12
- Status: Accepted
- Context:
  - Subject qualification was previously hardcoded via keyword heuristics, violating the project's goal of a generic architecture.
  - Specializations synced from EnrollPro were often siloed in departments, making it hard to match granular teacher expertise to subject requirements.
- Decision:
  - Implement a Tiered Qualification Matcher (Tier 1: Explicit Specialization, Tier 2: Structural Department, Tier 3: Dynamic Alias Mapping).
  - Introduce `SpecializationAlias` model in Prisma to allow Officers to define synonyms for specializations without code changes.
  - Centralize logic in `QualificationService` on the backend to ensure consistency across the UI and Genetic Scheduler.
- Consequences:
  - Removed hardcoded `JHS_DEPT_KEYWORDS` bottleneck.
  - Improved scheduler precision by prioritizing direct specialization matches.
  - Added transparency to the scheduling process with "Qualification Audit" dashboards.
- Links:
  - `atlas-server/src/services/qualification.service.ts`
  - `atlas-client/src/pages/SpecializationMapping.tsx`
  - `atlas-client/src/pages/Audit.tsx`
