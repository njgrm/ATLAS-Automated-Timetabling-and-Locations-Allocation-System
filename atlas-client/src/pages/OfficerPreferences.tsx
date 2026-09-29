import { Navigate } from 'react-router-dom';

/**
 * A3 c13 — `/faculty/preferences` is folded into Teacher Concerns.
 *
 * The legacy `FacultyPreference` review list (wellbeing toggles: pregnancy,
 * mobility, travel, floors) is retired. It was already superseded for generation
 * input by `FacultyAvailability`, which is what Teacher Concerns records — so
 * this route carried a second name for a page that no longer decided anything.
 *
 * NOT MOVED, ON PURPOSE: the wellbeing toggles are not offered on the concerns
 * form. Verified before dropping them — generation reads availability
 * (`getReviewedAvailability`, `status: 'REVIEWED'` only) and the room-request
 * gate; nothing in the generation path reads the `FacultyPreference` wellbeing
 * columns, so a "Ground floor only" checkbox here would be a control that
 * changes nothing. If generation ever starts honouring those fields, the honest
 * place for them is this form.
 *
 * `replace` so the old URL does not sit in history as a second way in.
 */
export default function OfficerPreferences() {
	return <Navigate to='/faculty/concerns' replace />;
}
