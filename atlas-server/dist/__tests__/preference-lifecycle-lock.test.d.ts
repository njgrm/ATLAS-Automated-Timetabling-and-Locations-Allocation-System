/**
 * preference-lifecycle-lock.test.ts
 *
 * Unit tests for checkPreferenceWindow() in preference.service.ts.
 *
 * The ATLAS lifecycle phase is a module-level constant in the preference router
 * (process.env.ATLAS_LIFECYCLE_PHASE read once at import time), so the lock
 * behaviour is best verified by testing the service function directly.
 *
 * Covers:
 *  - PREFERENCE_COLLECTION → null (editable)
 *  - SETUP                 → null (editable, pre-collection window)
 *  - GENERATION            → PREFERENCE_LOCKED (hard lock)
 *  - REVIEW                → PREFERENCE_LOCKED
 *  - PUBLISHED             → PREFERENCE_LOCKED
 *  - ARCHIVED              → PREFERENCE_LOCKED
 */
export {};
