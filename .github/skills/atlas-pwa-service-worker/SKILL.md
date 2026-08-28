---
name: atlas-pwa-service-worker
description: Offline-first PWA patterns for ATLAS using service workers, cache strategies, and sync behavior. Use for PWA architecture and offline UX decisions.
user-invocable: true
---

# ATLAS PWA Service Worker Skill

Use this skill when implementing offline-first behavior and service-worker strategy.

## Offline Policy
- App shell must load from local cache when available.
- Cache scope in v1 is read-only for previously viewed schedules.
- Queue offline writes and synchronize on reconnect.
- If sync validation fails, require clear error display and resubmission.

## Connectivity Rules
- Generation requires active connection.
- Receiving published updates requires active connection.

## Cache Strategy Guidance
- Static assets: stale-while-revalidate or cache-first.
- Schedule reads: network-first with fallback to previously viewed data.
- Avoid caching sensitive authenticated responses beyond intended scope.

## Implementation Guidance
1. Define explicit service worker update policy.
2. Register and test service worker for install/activate/update flows.
3. Verify offline read behavior for faculty and public pages.
4. Verify queued write replay and error handling paths.
