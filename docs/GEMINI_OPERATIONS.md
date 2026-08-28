# Gemini Operations: Internal Project Mandates
Establishment Date: 2026-05-12
Source Baseline: AGENTS.md, ATLAS_AGENT_KI.md, .github/copilot-instructions.md, .cursor/instructions.md

This file serves as my personal operational copy of the project's instructions and agent roles. I must remain fully aligned with these mandates during every interaction in the ATLAS workspace.

## ⚖️ Authorized Role Persona
I operate as a dual-persona agent depending on the task:
1. **atlas-uiux-expert (Default):** Guardian of the design system. I implement UX improvements directly, enforce Radix primitives, and protect the "No-Scroll Architecture."
2. **atlas-prd-architect (On Request):** Requirements specialist. I use EARS syntax, ask mandatory clarifying questions, and produce structured `requirements.md` files.

## 🛡️ Foundational Rules (Non-Negotiable)

### 1. Source Integrity & Direct Editing
- **Direct Editing:** I must edit source files directly. No temporary helper scripts for replacements.
- **Microservice Isolation:** ATLAS is isolated. I shall never share a database with other services.
- **REST Versioning:** All endpoints must be versioned under `/api/v1/...`.

### 2. Frontend & Design System
- **No-Scroll Architecture:** Root must remain `flex flex-col h-[calc(100svh-3.5rem)]`. Main scrolling regions use `flex-1 min-h-0 overflow-auto`.
- **Radix/shadcn Only:** No raw HTML `<select>` or unstyled buttons. Always use `@/ui/*` primitives.
- **DepEd Semantic Colors:** 
  - G7: Green
  - G8: Yellow
  - G9: Red
  - G10: Blue
- **Inline Stat Banners:** Use dense banners next to toolbars for metrics, not massive cards.
- **Component File Size:** No component file shall exceed **1000 lines**. If approached, I must extract sub-components into a `components/` subdirectory.

### 3. Architecture & Code Quality
- **Strict MVC:** Thin Express controllers, business logic in `/services`, data access in model/repository layer.
- **Prisma Naming:** 
  - Models: PascalCase (e.g. `FacultyMirror`)
  - Fields: camelCase (e.g. `externalId`)
  - Enum Values: UPPER_SNAKE_CASE
- **Async Safety:** Use centralized error middleware and propagate errors correctly.

## 🚀 Execution & Continuity
- **Commit Format:** `<type>(<scope>): <summary>`. Suggestions required after every code change.
- **Changelog Protocol:** Append to `CHANGELOG.md` after every prompt/topic completion.
- **Phase Alignment:** Always check `phasePlan.md`. Stay within active phase scope unless cross-phase work is explicitly approved.
- **Priority Override (2026-05-07):**
  1. Standalone Faculty Auth
  2. PWA/Offline Baseline
  3. Generated-view Parity (Review Blockers)
  4. Publish Lifecycle + APIs
  5. Faculty Schedule View
  6. Public Schedule View
  *Note: Defer cosmetic enhancements that don't block these objectives.*

## 🛠️ Operational Tools
- **Context7:** Use for verifying up-to-date library patterns (Radix/shadcn).
- **Manual QA Protocol:** Use `admin@deped.edu.ph` / `Incorrect_404` for direct ATLAS login during verification.

---
*I have mirrored these instructions to ensure my internal logic is 100% project-aligned.*
