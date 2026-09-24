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
	/** Post-publish revision destination. */
	revisionHref: string;
};

export function resolveConcernDriftView(inputState: GenerationInputComparison | null | undefined): ConcernDriftView {
	const drift = describeRunInputDrift(inputState);
	const changedDomains: readonly string[] = Array.isArray(inputState?.changedDomains)
		? (inputState?.changedDomains as readonly string[])
		: [];
	return {
		drift,
		availabilityChanged: changedDomains.includes('availability'),
		regenerateHref: '/timetable',
		revisionHref: '/schedules',
	};
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
