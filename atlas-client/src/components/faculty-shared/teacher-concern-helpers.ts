/**
 * S2 — pure helpers for the scheduler concern workspace.
 *
 * The drift view delegates to the shared `describeRunInputDrift` (read-only;
 * S4-client owns that file). It does NOT fork a second seven-domain mapping:
 * it only adds the availability-specific flag this lane is responsible for and
 * the explicit regenerate/revision destinations.
 */
import { describeRunInputDrift, type RunInputDrift } from '@/components/timetable/timetableDriftRouting';
import type { FacultyAvailabilityRecord, GenerationInputComparison } from '@/types';

export const CONCERN_NOTES_HEADING = 'Notes for the scheduler';
export const CONCERN_ROOM_REQUESTS_HEADING = 'Room requests';

/**
 * The S1 authority persists exactly one `notes` string. The workspace keeps
 * notes and room requests as separate labelled sections inside it so both
 * survive a round trip without inventing a second persistence contract.
 */
export function composeConcernNotes(notes: string, roomRequests: string): string | null {
	const trimmedNotes = notes.trim();
	const trimmedRooms = roomRequests.trim();
	if (!trimmedNotes && !trimmedRooms) return null;
	const sections: string[] = [];
	if (trimmedNotes) sections.push(`[${CONCERN_NOTES_HEADING}]\n${trimmedNotes}`);
	if (trimmedRooms) sections.push(`[${CONCERN_ROOM_REQUESTS_HEADING}]\n${trimmedRooms}`);
	return sections.join('\n\n');
}

function readSection(raw: string, heading: string): string {
	const headingIndex = raw.indexOf(heading);
	if (headingIndex === -1) return '';
	const from = headingIndex + heading.length;
	const nextNote = raw.indexOf(`[${CONCERN_NOTES_HEADING}]`, from);
	const nextRoom = raw.indexOf(`[${CONCERN_ROOM_REQUESTS_HEADING}]`, from);
	const candidates = [nextNote, nextRoom].filter((index) => index >= 0);
	const end = candidates.length > 0 ? Math.min(...candidates) : raw.length;
	return raw.slice(from, end).trim();
}

/** Parse the frozen notes string back into its labelled sections. */
export function parseConcernNotes(raw: string | null | undefined): { notes: string; roomRequests: string } {
	if (!raw) return { notes: '', roomRequests: '' };
	const noteHeading = `[${CONCERN_NOTES_HEADING}]`;
	const roomHeading = `[${CONCERN_ROOM_REQUESTS_HEADING}]`;
	const hasLabelledSection = raw.includes(noteHeading) || raw.includes(roomHeading);
	if (!hasLabelledSection) {
		// Legacy/free-text notes are shown verbatim as notes; nothing is lost.
		return { notes: raw.trim(), roomRequests: '' };
	}
	return {
		notes: readSection(raw, noteHeading),
		roomRequests: readSection(raw, roomHeading),
	};
}

export type ConcernDriftView = {
	/** The shared mapping output, rendered verbatim. */
	drift: RunInputDrift;
	/** Raw `availability` domain membership (the shared file maps 5 of 7 today). */
	availabilityChanged: boolean;
	/** Explicit regenerate destination (draft board). */
	regenerateHref: string;
};

/** This page's own route — a drift link back to it is a self-link, not a repair. */
export const CONCERN_ROUTE = '/faculty/concerns';

export function resolveConcernDriftView(inputState: GenerationInputComparison | null | undefined): ConcernDriftView {
	const drift = describeRunInputDrift(inputState);
	const changedDomains: readonly string[] = Array.isArray(inputState?.changedDomains)
		? (inputState?.changedDomains as readonly string[])
		: [];
	return {
		drift,
		availabilityChanged: changedDomains.includes('availability'),
		regenerateHref: '/timetable',
	};
}

/**
 * A3-C6/C3 — the shared drift mapping reports a machine status, and this card
 * is the one surface that shows it verbatim. FRESH / STALE / UNKNOWN are
 * internal enum tokens; the badge already carries a tone, so only the WORDS
 * were the defect. The map is route-scoped to the concern surface on purpose:
 * `timetableDriftRouting` belongs to the Timetable lane and is not edited here.
 */
export function concernDriftStatusLabel(status: 'FRESH' | 'STALE' | 'UNKNOWN'): string {
	switch (status) {
		case 'FRESH':
			return 'Up to date';
		case 'STALE':
			return 'Out of date';
		default:
			return 'Not yet compared';
	}
}

export type ConcernDriftLink = { href: string; label: string };

/**
 * A3-C6/C4 — the action links for this card, de-duplicated by destination.
 *
 * Two defects came from rendering the raw trio:
 *   - `availability` is this page's OWN canonical repair home, so "Open owning
 *     setup" resolved to the page the operator was already reading.
 *   - `policy` also resolves to `/timetable`, byte-identical to the regenerate
 *     destination, so one destination appeared under two labels.
 *
 * Both are suppressed here rather than in the component, so the rule is one
 * testable function. The domain CHIPS keep naming every changed domain — they
 * are labels, and navigation belongs to this list, so no destination is ever
 * offered twice.
 *
 * There is no separate "Published revisions" href. The revision surface was
 * proven reachable from the Class Schedule (`/timetable`) — App.tsx mounts
 * ScheduleReview there, whose workspace renders CenterWorkspace, which mounts
 * TacticalSandboxDock, which renders PublishedRevisionDialog — so one link to
 * Class Schedule honestly covers BOTH regenerating a draft and revising a
 * published run. The old `/schedules` target was a room/teacher/section
 * browser with no revision concept at all.
 */
export function resolveConcernDriftLinks(view: ConcernDriftView, currentHref: string = CONCERN_ROUTE): ConcernDriftLink[] {
	const links: ConcernDriftLink[] = [{ href: view.regenerateHref, label: 'Open Class Schedule' }];
	const owningHref = view.drift.primaryHref;
	const isSelfLink = owningHref === currentHref;
	const duplicatesClassSchedule = owningHref === view.regenerateHref;
	if (!isSelfLink && !duplicatesClassSchedule) {
		links.push({ href: owningHref, label: 'Open owning setup' });
	}
	return links;
}

export function availabilityStatusLabel(status: FacultyAvailabilityRecord['status'] | null | undefined): string {
	switch (status) {
		case 'DRAFT':
			return 'Draft';
		case 'SUBMITTED':
			return 'Submitted for review';
		case 'REVIEWED':
			return 'Reviewed and binding';
		case 'REJECTED':
			return 'Returned for correction';
		default:
			return 'Not recorded yet';
	}
}

export function availabilityStatusTone(status: FacultyAvailabilityRecord['status'] | null | undefined): 'secondary' | 'warning' | 'success' | 'danger' | 'outline' {
	switch (status) {
		case 'DRAFT':
			return 'secondary';
		case 'SUBMITTED':
			return 'warning';
		case 'REVIEWED':
			return 'success';
		case 'REJECTED':
			return 'danger';
		default:
			return 'outline';
	}
}
