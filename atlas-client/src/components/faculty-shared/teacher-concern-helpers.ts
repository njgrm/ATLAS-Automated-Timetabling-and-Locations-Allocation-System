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
export const CONCERN_ROUTE = '/faculty/preferences';

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
 * A3-C6/C4 — the ACTION links for this card, de-duplicated by destination.
 *
 * Three defects came from rendering the raw trio:
 *   - `availability` is this page's OWN canonical repair home, so "Open owning
 *     setup" resolved to the page the operator was already reading.
 *   - `policy` also resolves to `/timetable`, byte-identical to the regenerate
 *     destination, so one destination appeared under two labels.
 *   - Every mapped changed domain is ALSO a chip on this card, and that chip
 *     links to the same canonical home. `primaryHref` is `domains[0].href` by
 *     construction (see `timetableDriftRouting`), so the owning-setup action
 *     always restated a domain chip.
 *
 * All three are suppressed here rather than in the component, so the rule is one
 * testable function. What is suppressed is the duplicate ACTION, never the
 * navigation: each changed domain still reaches its canonical home through its
 * own chip, and the owning-setup link survives in the unmapped-fallback case,
 * where `/admin/year-setup` is the ONLY route to the umbrella repair.
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
	// The domain chips already offer every changed domain's canonical home.
	const duplicatesDomainChip = view.drift.domains.some((domain) => domain.href === owningHref);
	if (!isSelfLink && !duplicatesClassSchedule && !duplicatesDomainChip) {
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

/* ════════════════════════════════════════════════════════════════════════════
 * ROOMS + the single Save — A3 c13.
 *
 * These are PURE so the wording is decidable without a browser: the two lines
 * a scheduler actually reads on this page (what the move will do, and what was
 * just saved) are both generated here, and neither may leak a status enum, a
 * room id, a run id or a raw code into the sentence.
 * ═══════════════════════════════════════════════════════════════════════════ */

const DAY_WORDS: Record<string, string> = {
	MONDAY: 'Monday',
	TUESDAY: 'Tuesday',
	WEDNESDAY: 'Wednesday',
	THURSDAY: 'Thursday',
	FRIDAY: 'Friday',
	SATURDAY: 'Saturday',
	SUNDAY: 'Sunday',
};

/** "Mon 08:00-09:00" in plain words. Never a raw enum. */
export function describeClassPeriod(day: string | null | undefined, startTime: string, endTime: string): string {
	const dayWord = day ? DAY_WORDS[String(day).toUpperCase()] ?? String(day) : '';
	return dayWord ? `${dayWord} ${startTime}-${endTime}` : `${startTime}-${endTime}`;
}

export type RoomPreviewLine = {
	/** `ok` reads as a fact; `blocked` as something the scheduler must change. */
	tone: 'ok' | 'blocked';
	text: string;
};

/**
 * THE PREVIEW LINE — the zero-write `preview` response in one sentence a mouse-
 * first scheduler can act on.
 *
 * Every fact here comes from the response: the class, both room NAMES (never
 * ids), and the server's own first conflict message when there is one. A
 * response that is neither allowed nor self-explanatory degrades to a truthful
 * "could not be checked" rather than to an invented reassurance.
 */
export function describeRoomPreview(input: {
	sectionName: string;
	currentRoomName: string;
	requestedRoomName: string | null;
	period: string;
	preview: {
		allowed?: boolean;
		hardViolations?: { message?: string }[];
		softViolations?: { message?: string }[];
	} | null | undefined;
}): RoomPreviewLine {
	const { sectionName, currentRoomName, requestedRoomName, period, preview } = input;
	const move = `Moves ${sectionName} to ${requestedRoomName ?? 'the chosen room'} on ${period}, from ${currentRoomName}.`;

	if (!preview) {
		return {
			tone: 'blocked',
			text: requestedRoomName
				? `Save first, then ATLAS will show what moving ${sectionName} to ${requestedRoomName} would do.`
				: 'Pick a room to see what the move would do.',
		};
	}

	const hard = preview.hardViolations?.[0]?.message?.trim();
	if (hard) return { tone: 'blocked', text: `Cannot move ${sectionName} to ${requestedRoomName ?? 'that room'}: ${hard}` };

	const soft = preview.softViolations?.[0]?.message?.trim();
	if (soft) return { tone: 'blocked', text: `${move} ATLAS flagged: ${soft}` };

	if (preview.allowed === false) {
		return { tone: 'blocked', text: `Cannot move ${sectionName} to ${requestedRoomName ?? 'that room'} on ${period}.` };
	}

	return { tone: 'ok', text: `${move} Nothing clashes.` };
}

export type ConcernSaveCounts = {
	teacherName: string;
	/** Availability windows the scheduler actually marked. */
	availabilityWindows: number;
	/** Classes with a room need waiting to be moved. */
	roomNeeds: number;
	/** Whether the Anything-else box has text. */
	hasNote: boolean;
	/** Set when the server saved but could not make the record bind. */
	bindFailure: string | null;
};

/**
 * THE CONFIRMATION — one plain sentence naming what was saved, the way the
 * brief asks ("Saved John's availability, 2 room needs and 3 notes"). Only the
 * parts that were really written are named; a count is never invented.
 */
export function describeSavedConcern(counts: ConcernSaveCounts): string {
	const { teacherName, availabilityWindows, roomNeeds, hasNote, bindFailure } = counts;
	const parts: string[] = [];
	if (availabilityWindows > 0) parts.push(`${availabilityWindows === 1 ? 'their availability' : `their availability (${availabilityWindows} windows)`}`);
	if (roomNeeds > 0) parts.push(`${roomNeeds === 1 ? '1 room need' : `${roomNeeds} room needs`}`);
	if (hasNote) parts.push('your note');

	const what = parts.length > 0 ? parts.join(', ') : 'nothing yet';
	const head = `Saved ${teacherName}: ${what}.`;
	if (!bindFailure) return head;
	// The save succeeded and the refusal is real information, so both are said.
	return `${head} ATLAS could not yet make it count for building the timetable: ${bindFailure}`;
}

/**
 * The ONE status chip in the header. It reports the save state of the selected
 * teacher in words — never `DRAFT`, `SUBMITTED`, `REVIEWED`, a version or a run
 * id, which is the vocabulary this page was built to remove.
 */
export function concernSaveStateLabel(input: {
	selected: boolean;
	saved: boolean;
	bindFailure: boolean;
}): string {
	if (!input.selected) return 'No teacher chosen';
	if (input.bindFailure) return 'Saved, not yet counted';
	return input.saved ? 'Saved' : 'Nothing saved yet';
}

export function concernSaveStateTone(input: { selected: boolean; saved: boolean; bindFailure: boolean }): 'outline' | 'success' | 'warning' {
	if (!input.selected) return 'outline';
	if (input.bindFailure) return 'warning';
	return input.saved ? 'success' : 'outline';
}
