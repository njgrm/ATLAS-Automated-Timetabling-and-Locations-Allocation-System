/**
 * A2-C6-TRUTH (T3f) — the status region is capped, and says what it dropped.
 *
 * The live measurement, 2026-09-28, Simple view: SIX message rows above the grid
 * (term authority, last build failed, non-blocking hard notice, school names
 * refreshed, curriculum readiness). Each was a separate conditional `<p>`, so
 * every one of them appeared whenever its own condition held and the stack grew
 * without limit.
 *
 * A stack of notices is read as noise, and the notices that lose are the
 * bottom ones — which is how a genuinely new fact ends up below the fold. So the
 * region shows the first three and states the remainder: `and N more`. The count
 * is always printed, so a capped region can never be mistaken for a complete
 * one — the defect class of this whole packet, applied to its own fix.
 *
 * ORDER IS THE PRIORITY ORDER, most-actionable first, and it is the same order
 * the rows appeared in before the cap, so no notice changed its relative
 * precedence. The condition for each row is unchanged: this component only
 * decides WHICH rows render, never whether a fact is true.
 */

import type { ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

export type SimpleHeaderMessage = {
	/** Stable key, also the addressable `data-testid` suffix. */
	id: string;
	/** Plain-language sentence the operator reads. */
	text: string;
	tone: 'neutral' | 'warning' | 'danger' | 'good';
	/** Optional technical detail, disclosed through a @/ui tooltip, never a `title`. */
	diagnostic?: string | null;
	/** Long messages stay truncatable rather than pushing the action row away. */
	truncate?: boolean;
};

/**
 * The rows the status region shows, in priority order, from the conditions the
 * header already computes.
 *
 * Every `data-testid` the pre-cap rows carried is preserved on the element that
 * renders it, so the committed rows that address `timetable-term-authority-unverified`,
 * `timetable-last-generation-failed-message`, `timetable-non-blocking-hard-notice`,
 * `timetable-school-names-refreshed` and `timetable-curriculum-readiness-message`
 * still decide on this component.
 */
export function buildSimpleHeaderMessages(input: {
	latestRunFailed: boolean;
	nonBlockingHardCount: number;
	schoolNamesRefreshed: boolean;
	setupBlockedDiagnostic: string | null;
	setupOperatorMessage: string;
}): SimpleHeaderMessage[] {
	const messages: SimpleHeaderMessage[] = [];

	if (input.latestRunFailed) {
		messages.push({
			id: 'timetable-last-generation-failed-message',
			tone: 'danger',
			truncate: true,
			text: 'The last schedule build did not finish. Check schedule information, then try again.',
		});
	}
	if (input.nonBlockingHardCount > 0) {
		const count = input.nonBlockingHardCount;
		messages.push({
			id: 'timetable-non-blocking-hard-notice',
			tone: 'warning',
			truncate: true,
			text: `${count} rule break${count === 1 ? '' : 's'} did not stop publishing, but ${count === 1 ? 'it is' : 'they are'} still worth reviewing.`,
		});
	}
	if (input.setupBlockedDiagnostic) {
		messages.push({
			id: 'timetable-curriculum-readiness-message',
			tone: 'neutral',
			text: input.setupOperatorMessage,
			diagnostic: input.setupBlockedDiagnostic,
		});
	}
	if (input.schoolNamesRefreshed) {
		messages.push({
			id: 'timetable-school-names-refreshed',
			tone: 'good',
			truncate: true,
			text: 'School names refreshed. The schedule did not change.',
		});
	}
	return messages;
}

/** How many rows the region shows. The rest are counted, never silently dropped. */
export const SIMPLE_HEADER_MESSAGE_LIMIT = 3;

/** One row. The technical detail stays behind a @/ui Tooltip, per AGENTS.md §8. */
export function SimpleHeaderMessageRow({ message }: { message: SimpleHeaderMessage }) {
	const toneClass = message.tone === 'danger'
		? 'text-red-700'
		: message.tone === 'warning'
			? 'text-amber-800'
			: message.tone === 'good'
				? 'text-emerald-800'
				: 'text-muted-foreground';
	const className = `min-w-0 text-xs font-medium ${toneClass}${message.truncate ? ' truncate' : ' break-words'}`;

	if (!message.diagnostic) {
		return (
			<p className={className} data-testid={message.id}>
				{message.text}
			</p>
		);
	}
	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<p
						className={`${className} underline decoration-dotted decoration-muted-foreground/50 underline-offset-2`}
						data-testid={message.id}
						tabIndex={0}
					>
						{message.text}
					</p>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
					<span className="block font-semibold">Technical detail</span>
					<span className="mt-1 block">{message.diagnostic}</span>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/** The rows plus the honest remainder count. */
export function SimpleHeaderMessageList({ messages }: { messages: readonly SimpleHeaderMessage[] }) {
	const shown = messages.slice(0, SIMPLE_HEADER_MESSAGE_LIMIT);
	const hidden = messages.length - shown.length;
	return (
		<>
			{shown.map((message) => <SimpleHeaderMessageRow key={message.id} message={message} />)}
			{hidden > 0 ? (
				<p className="min-w-0 text-xs text-muted-foreground" data-testid="timetable-status-messages-more">
					and {hidden} more
				</p>
			) : null}
		</>
	);
}

export type { ReactNode };
