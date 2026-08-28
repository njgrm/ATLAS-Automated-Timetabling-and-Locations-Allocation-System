---
name: atlas-offline-realtime-reliability
description: Verifies offline queue lifecycle states, sync recovery, and realtime fallback UX behavior for SSE/WebSocket features.
user-invocable: true
---

# ATLAS Offline + Realtime Reliability Skill

Use this skill whenever a feature includes offline writes, sync status, SSE, or WebSocket updates.

## Queue Lifecycle Verification
- Validate all client-visible states:
  - `queued`
  - `syncing`
  - `synced`
  - `failed`
- Confirm transitions are deterministic and user-visible.

## Failure Recovery Checks
- Simulate reconnect after offline queue accumulation.
- Verify retry controls for failed actions.
- Ensure failed actions provide clear next steps.

## Realtime Transport Checks
- Primary path must work with configured realtime transport.
- If transport fails, fallback UX must be explicit and non-breaking.
- Confirm no silent stale-state behavior.

## UX Messaging Requirements
- Offline banners are informative, not blocking.
- Status indicators avoid duplicate/conflicting messages.
- Copy explains what updates automatically vs what needs user action.

## Evidence Requirements
- Record each state with screenshot + short reproduction notes.
- Include one run proving successful recovery from failure state.
