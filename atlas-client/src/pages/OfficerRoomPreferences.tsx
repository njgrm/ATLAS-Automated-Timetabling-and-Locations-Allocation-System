import { Navigate } from 'react-router-dom';

/**
 * A3 c13 — `/faculty/room-preferences` is folded into Teacher Preferences.
 *
 * The 692-line review queue this route used to mount is retired, and the nav
 * item that pointed at it is gone. Everything a scheduler did here — record a
 * room need, preview the move, apply it — now happens on the selected teacher's
 * form at `/faculty/preferences`, per class, with the room name beside the room
 * the generator already chose.
 *
 * `replace` so the old URL does not sit in history as a second way in: one
 * destination, one label.
 */
export default function OfficerRoomPreferences() {
	return <Navigate to='/faculty/preferences' replace />;
}
