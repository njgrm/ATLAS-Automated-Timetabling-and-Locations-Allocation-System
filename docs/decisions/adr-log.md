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
  - Requires disciplined updates across related docs on each accepted batch.
