/**
 * Fix 24 — the Teachers header action copy, and the fit contract for the row
 * that holds it.
 *
 * THE COPY IS THE ORIGINAL, NOT THE SHORTENED VARIANT.
 *
 * The original requested copy is:
 *   - `Create Temporary` -> `Create temporary teacher (Teacher X)`
 *   - `Refresh teacher roster` -> `Refresh teacher list`
 * and "Menu must grow enough to keep these labels on one line."
 *
 * FIX 24.1 (operator, 2026-09-28) — the SECOND rename of the same action, and
 * the one that is now shipped: `Refresh teacher list` -> `Update teacher list`.
 * The requested header is a plain sequence of direct buttons, and "refresh"
 * describes a background re-read while "update" describes what the scheduler
 * actually does to their roster. The constant is renamed rather than
 * re-valued so every consumer moves together: an old name left in place is
 * how the two variants drifted in the first place.
 *
 * An earlier cycle in this stream deliberately SHORTENED both labels to
 * "Add temporary" and "Refresh roster" so they would fit, which is the direct
 * opposite of the criterion and left the live symptom ("the menu reads 'Add
 * temporary' / 'Refresh roster'") in place. Cycle c10 re-issues the original and
 * the shortening is overruled. The strings below are single-sourced so the
 * desktop and the mobile/menu variant of the same action cannot drift apart.
 *
 * THE FIT MEASUREMENT IS A REAL PRIMITIVE, AND IT IS HONEST ABOUT JSDOM.
 *
 * `actionLabelFits` is the pure decision function over measured pixel widths;
 * it is unit-tested at 1366x768 and at a narrow width. `measureRosterActionLabel`
 * is the runtime half that reads `getBoundingClientRect()` in a real browser and
 * publishes the verdict on the row as `data-label-fits`, so a real-browser pass
 * (Lane C) can read the result instead of inferring it from class names.
 *
 * A JSDOM test environment reports every rect as 0. Returning "fits" for a
 * measurement that never happened would be a vacuous control, so `unmeasurable`
 * is a first-class outcome and is never collapsed into `fits`.
 */

/**
 * `Create temporary teacher (Teacher X)` — the operator's wording, LITERALLY.
 *
 * FIX 24.2 (operator, 2026-09-29). The label used to interpolate the NEXT ROSTER
 * NUMBER, so it rendered `Create temporary teacher (Teacher 42)` and grew with
 * the roster. The operator's own words put a LITERAL capital `X` in that
 * parenthetical, and the distinction is the whole point: `X` says "the next one,
 * the one you are about to create", while a number says "this is teacher 42, and
 * it already exists" — the opposite of what the button does. It also meant the
 * label — and therefore the fit budget below — changed width every time a
 * temporary teacher was added, so the control a scheduler re-reads all term was
 * never the same width twice.
 *
 * The function keeps its name and its single-source role (it is still how the
 * copy reaches `FacultyRosterActions`), but it is now a constant function with
 * no arguments. An optional argument that no longer changes the result would be
 * a parameter left behind to look load-bearing, so it is REMOVED rather than
 * ignored: the number plumbing is gone from `pages/Faculty.tsx` and from
 * `FacultyRosterActions` with it.
 */
export function temporaryTeacherActionLabel(): string {
	return CREATE_TEMPORARY_TEACHER_ACTION_LABEL;
}

/** The one string, so a test can pin it without re-typing it. */
export const CREATE_TEMPORARY_TEACHER_ACTION_LABEL = 'Create temporary teacher (Teacher X)';

/**
 * The requested update/refresh copy, verbatim: `Update teacher list`.
 *
 * Renamed from `REFRESH_TEACHER_LIST_LABEL` in fix 24.1. The old name is
 * removed rather than aliased: a second exported name for one string is a third
 * way for the header copy to drift, which is the defect this module exists to
 * prevent.
 */
export const UPDATE_TEACHER_LIST_LABEL = 'Update teacher list';

/**
 * The longest string the row can ever be asked to render.
 *
 * Since fix 24.2 the label is a FIXED literal — it no longer grows with the
 * teacher count, so a row that fits this string fits it at every roster size.
 * That is the whole point of the constant: the fit budget below is now decided
 * once, at authoring time, instead of being re-derived from a live count.
 */
export const LONGEST_ROSTER_ACTION_LABEL = CREATE_TEMPORARY_TEACHER_ACTION_LABEL;

/** Breathing room the label needs inside its container, in CSS pixels. */
export const ACTION_LABEL_PADDING_PX = 16;

export type ActionLabelFit =
	| { outcome: 'fits'; labelWidth: number; available: number }
	| { outcome: 'clips'; labelWidth: number; available: number }
	/** No layout was available (JSDOM, or a display:none ancestor). Never a pass. */
	| { outcome: 'unmeasurable'; labelWidth: number; available: number };

/**
 * Decide whether a measured label width fits the narrower of its container and
 * the viewport, less the padding the label needs.
 *
 * Pure: takes numbers, returns a verdict. This is the half a test can drive
 * without a layout engine, and the half that decides at every viewport width.
 */
export function actionLabelFits(
	labelWidth: number,
	containerWidth: number,
	viewportWidth: number,
): ActionLabelFit {
	const available = Math.min(containerWidth, viewportWidth) - ACTION_LABEL_PADDING_PX;
	if (!Number.isFinite(labelWidth) || !Number.isFinite(available) || labelWidth <= 0 || available <= 0) {
		return { outcome: 'unmeasurable', labelWidth, available };
	}
	return labelWidth <= available
		? { outcome: 'fits', labelWidth, available }
		: { outcome: 'clips', labelWidth, available };
}

/**
 * Measure a rendered label against its row and publish the verdict.
 *
 * `labelEl` is the text node's element, `rowEl` the flex row that must grow to
 * hold it. Returns the verdict and mirrors it onto `rowEl.dataset.labelFits` so
 * a real-browser check can read the rendered outcome.
 */
export function measureRosterActionLabel(
	labelEl: Element | null,
	rowEl: HTMLElement | null,
	viewportWidth: number,
): ActionLabelFit {
	if (!labelEl || !rowEl) {
		return { outcome: 'unmeasurable', labelWidth: 0, available: 0 };
	}
	const labelRect = labelEl.getBoundingClientRect();
	const rowRect = rowEl.getBoundingClientRect();
	const verdict = actionLabelFits(labelRect.width, rowRect.width, viewportWidth);
	rowEl.dataset.labelFits = verdict.outcome;
	return verdict;
}
