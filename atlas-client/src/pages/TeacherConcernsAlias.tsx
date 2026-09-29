import { Navigate } from 'react-router-dom';

/**
 * A3 c15 — `/faculty/concerns` is a RETIRED ALIAS. The consolidated page is
 * Teacher Preferences at `/faculty/preferences`, so this path redirects instead
 * of mounting a second page under the old name.
 *
 * `replace` so the retired URL does not sit in history as a second way in.
 */
export default function TeacherConcernsAlias() {
	return <Navigate to='/faculty/preferences' replace />;
}
