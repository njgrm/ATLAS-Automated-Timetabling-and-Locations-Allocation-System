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
 * `Create temporary teacher (Teacher X)`, with the real next teacher number.
 *
 * `X` is defensive on purpose. A missing or malformed number must NOT render the
 * literal "undefined" into a control a scheduler reads — an earlier iteration of
 * this file did exactly that when a caller omitted the prop, and the committed
 * `F24-2` control caught it by failing on `Create temporary teacher (Teacher
 * undefined)`. Production always passes a real number
 * (`(rosterStats?.totalCount ?? faculty.length) + 1` in `pages/Faculty.tsx`), so
 * the parenthetical is present on the real path; the fallback only covers a
 * caller that has no roster count to offer.
 */
export function temporaryTeacherActionLabel(nextTeacherNumber?: number | null): string {
	if (nextTeacherNumber == null || !Number.isFinite(nextTeacherNumber) || nextTeacherNumber <= 0) {
		return 'Create temporary teacher';
	}
	return `Create temporary teacher (Teacher ${nextTeacherNumber})`;
}

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
 * Teacher numbers are unbounded, so a row that fits three digits can still clip
 * at four. This is the string the fit budget is measured against, and it is what
 * the unit control renders.
 */
export const LONGEST_ROSTER_ACTION_LABEL = temporaryTeacherActionLabel(9999);

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
