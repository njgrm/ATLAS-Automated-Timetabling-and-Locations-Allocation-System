import { Info } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';

/**
 * A3-C6-F2: the honest reading of a `preferenceStatus` the client does not
 * recognise.
 *
 * THE DEFECT
 *
 * `pages/OfficerPreferences.tsx` held `statusBadge(status: string)` whose
 * `default:` branch was `return <Badge variant='secondary'>{status}</Badge>` —
 * it rendered whatever arrived on the wire. The parameter was typed `string`,
 * NOT the `PreferenceStatus` union, so the branch was reachable for any value
 * the server sent and the type system permitted it. A scheduler would see a
 * raw enum where the other three rows say "Submitted", "Draft", "Missing".
 *
 * THE FACTS, verified rather than assumed
 *
 *  - `prisma/schema.prisma` `enum PreferenceStatus` has exactly two members,
 *    `DRAFT` and `SUBMITTED`.
 *  - `MISSING` is CLIENT-derived, not persisted: it is a member of
 *    `OfficerSummaryFacultyWithReview.preferenceStatus`
 *    (`'SUBMITTED' | 'DRAFT' | 'MISSING'`) and is derived by filtering
 *    faculties that never submitted.
 *  - So all three known states are mapped and the default branch is currently
 *    unreachable from the typed surface — but the value is a runtime payload
 *    from a network response, and a fail-open presentation is the defect class
 *    this stream exists to close, whether or not it is reachable today.
 *
 * THE CONTRACT (the same one `resolveSubjectMutationErrorCopy` keeps)
 *
 *  - The badge NEVER renders the raw value. The fallback label is a fixed
 *    constant, so no input can reach it.
 *  - It is a plain, honest sentence about what ATLAS actually knows: it has no
 *    plain name for this status, so it does not invent one. It does not guess
 *    that the value means "pending" or "draft" or anything else.
 *  - The raw value is DELAYED, not lost: it stays reachable in an `@/ui`
 *    Popover, which is what AGENTS.md §8 requires and what it forbids
 *    replacing with a bare `title=` attribute.
 *
 * ONE DELIBERATE DIVERGENCE FROM `SubjectMutationDetailPopover`
 *
 * That component shows the raw code as the trigger's visible text. Here the
 * trigger is icon-only and the raw value appears only inside the opened
 * popover, because F2's requirement is the STRONGER one: the default branch
 * must never render a raw code at all. For the same reason the trigger's
 * accessible name does not contain the raw value — a `title` or an
 * `aria-label` is read aloud by a screen reader, so putting the code there
 * would ship the very string this component exists to withhold.
 */
export type PreferenceStatusCopy = {
	/** False when ATLAS has no plain name for the value it received. */
	recognised: boolean;
	/** Fixed plain words. Never contains any part of the raw value. */
	label: string;
	/** Badge tone. The three known states keep their existing tones exactly. */
	variant: 'success' | 'warning' | 'danger' | 'secondary';
	/** Plain, honest explanation. Present only for the unrecognised case. */
	sentence: string;
	/** The stored value, verbatim. Diagnostic only — never rendered bare. */
	raw: string;
};

type KnownPreferenceStatus = { label: string; variant: PreferenceStatusCopy['variant'] };

/**
 * The three states ATLAS has plain words for. `MISSING` is client-derived
 * (`OfficerSummaryFacultyWithReview.preferenceStatus`); `DRAFT` and `SUBMITTED`
 * are the only two members of the persisted `PreferenceStatus` enum.
 */
const KNOWN_PREFERENCE_STATUSES: Readonly<Record<string, KnownPreferenceStatus>> = {
	SUBMITTED: { label: 'Submitted', variant: 'success' },
	DRAFT: { label: 'Draft', variant: 'warning' },
	MISSING: { label: 'Missing', variant: 'danger' },
};

/**
 * The unrecognised-value label and sentences. Fixed constants, so no input
 * reaches them.
 *
 * The wording asserts only what is true for EVERY value that lands here: ATLAS
 * has no plain name for it. It does not claim the value is wrong, does not
 * guess a meaning, and names no errand — a status ATLAS cannot read gives an
 * operator nothing to do, and inventing one would be the same fabrication c5
 * removed from the subject-error fallback.
 */
const UNRECOGNISED_LABEL = 'Unrecognised status';
const UNRECOGNISED_SENTENCE =
	'ATLAS has no plain name for this preference status, so it does not guess one. The status ATLAS received is kept in this detail rather than shown as a status ATLAS understands.';
const NO_STATUS_SENTENCE =
	'ATLAS received no status at all for this preference, so there is no plain name to show.';

/**
 * Resolve the honest reading of a `preferenceStatus` value. Total over
 * `unknown`: a blank, null, undefined or non-string value is a legitimate
 * input here, because the argument arrives from a network response, and it
 * must never surface the word "undefined" on screen.
 */
export function resolvePreferenceStatusCopy(status: unknown): PreferenceStatusCopy {
	const raw = typeof status === 'string' ? status.trim() : '';
	const known = raw ? KNOWN_PREFERENCE_STATUSES[raw] : undefined;
	if (known) {
		return { recognised: true, label: known.label, variant: known.variant, sentence: '', raw };
	}
	return {
		recognised: false,
		label: UNRECOGNISED_LABEL,
		// `secondary` is the tone the raw fallback already used, so the
		// unrecognised row keeps its existing appearance.
		variant: 'secondary',
		sentence: raw ? UNRECOGNISED_SENTENCE : NO_STATUS_SENTENCE,
		raw,
	};
}

export function PreferenceStatusBadge({ status }: { status: unknown }) {
	const copy = resolvePreferenceStatusCopy(status);
	if (copy.recognised) return <Badge variant={copy.variant}>{copy.label}</Badge>;

	return (
		<span className="inline-flex items-center gap-1">
			<Badge variant={copy.variant}>{copy.label}</Badge>
			<Popover>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						data-testid="preference-status-detail"
						// Deliberately does NOT include the raw value: an
						// accessible name is announced, so a code here would be
						// read aloud to the very operator this component is
						// protecting.
						aria-label="Preference status detail"
						className="h-5 w-5 gap-0 p-0 text-primary hover:underline"
					>
						<Info className="size-3" />
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-80 space-y-2 p-3 text-xs leading-relaxed">
					<p className="font-semibold uppercase tracking-wide text-muted-foreground">Status detail</p>
					<p>{copy.sentence}</p>
					{copy.raw ? (
						<p>
							<span className="font-semibold">Status ATLAS received</span>{' '}
							<span className="font-mono">{copy.raw}</span>
						</p>
					) : null}
				</PopoverContent>
			</Popover>
		</span>
	);
}
