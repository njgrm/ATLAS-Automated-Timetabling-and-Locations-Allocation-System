---
name: atlas-faculty-usability-first
description: Optimizes faculty UX for low-tech users with plain language, progressive disclosure, and one obvious next action per step.
user-invocable: true
---

# ATLAS Faculty Usability First Skill

Use this skill for any faculty-facing route, especially `/my`, `/my/preferences`, and `/my/room-preferences`.

## Core Usability Principles
- Prefer one obvious primary action per screen.
- Use plain language; avoid internal jargon.
- Keep instructions near the action they describe.
- Reduce cognitive load with progressive disclosure.

## Mandatory Checks
- Every screen has a clear "what to do next" action.
- Empty, loading, offline, and failed states include actionable text.
- Mobile tap targets are comfortable and avoid accidental taps.
- Banner content does not block first actionable content.

## Copy Rules
- Replace technical terms with faculty-friendly wording.
- Use short sentences and verbs first.
- Error text must state what happened + what to do now.

## Layout Rules
- Mobile-first hierarchy: primary action above fold.
- Desktop layout must expand working area for task content.
- Avoid dense global data dumps in faculty views; show faculty-specific context first.

## Verification
- Validate with timed task walkthroughs on mobile portrait and desktop.
- A pass requires users to complete primary tasks without external explanation.
