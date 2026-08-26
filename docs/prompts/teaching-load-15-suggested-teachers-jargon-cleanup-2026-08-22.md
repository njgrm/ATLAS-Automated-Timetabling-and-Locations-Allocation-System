# Prompt 15 — Suggested Teachers Technical Jargon Cleanup

## Goal
Remove technical backend jargon ("mirror-backed", "runtime policy", "upstream outage", and raw code flags) from the Suggested Teachers (AutoFill) summary modal, replacing it with scheduler-friendly language as required by the `GEMINI.md` guardrails.

## Context
When the scheduler runs the "Suggest Teaching Load" feature while ATLAS is disconnected from EnrollPro (or forced to use cached data), the modal displays raw backend diagnostic strings:
> "Staffing report is running on ATLAS mirror-backed section data by runtime policy (not due to an upstream outage)."
> "Fallback reason: atlas-mirror-preferred-runtime-control"

This violates the rule to "Prefer scheduler-friendly wording" and avoid exposing internal architecture terms to end users. Schedulers only need to know that ATLAS is using saved/offline data instead of a live connection.

## Target files
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`

## Tasks

### 1. Fix the Backend Warning Strings
In `atlas-server/src/services/teaching-load-automation.service.ts`, locate the `buildSectionSourceWarning` function. Update the return strings to be human-readable and scheduler-friendly:

```typescript
function buildSectionSourceWarning(sectionResult: SectionFetchResult): string | null {
	if (sectionResult.source === 'enrollpro') {
		return null;
	}

	if (sectionResult.source === 'stub') {
		return 'Using local stub data for this preview.';
	}

	if (sectionResult.source === 'atlas-mirror') {
		return 'Using saved ATLAS section data instead of a live connection to EnrollPro.';
	}

	const fallbackReason = (sectionResult.fallbackReason ?? '').trim();
	if (fallbackReason === 'atlas-mirror-preferred-runtime-control') {
		return 'Using saved ATLAS section data for this preview (live connection is paused).';
	}

	if (fallbackReason === 'atlas-snapshot-preferred-runtime-control') {
		return 'Using a saved snapshot of section data for this preview.';
	}

	// Never return the raw fallbackReason string to the user
	return 'Using saved ATLAS section data for this preview.';
}
```

### 2. Remove the Technical Fallback Reason from the UI
In `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`, locate the section that renders the warning box (around line 350-360).
Remove the rendering of `result.sectionFallbackReason` entirely. 

Delete this block:
```tsx
{result.sectionFallbackReason && result.sectionFallbackReason.length > 0 && (
	<p className="mt-1 text-xs font-medium opacity-80">Fallback reason: {result.sectionFallbackReason}</p>
)}
```
*(The `sectionSource` and the clean `warnings[0]` are sufficient context for the scheduler.)*

## Acceptance criteria
- [ ] Backend warning messages are rewritten to use clear, non-technical English.
- [ ] The raw `sectionFallbackReason` is no longer printed in the UI modal.
- [ ] No mention of "mirror-backed", "upstream outage", or "runtime-control" is visible to the end user.

## Verification commands
```bash
npx tsc --noEmit
npm run build --prefix atlas-server
npm run build --prefix atlas-client
```

## Report requirements
- Confirm that the backend logic was updated and the raw fallback reason was removed from the modal.
