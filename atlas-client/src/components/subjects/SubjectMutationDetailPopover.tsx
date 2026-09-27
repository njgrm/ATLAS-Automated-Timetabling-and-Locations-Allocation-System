import { Info } from 'lucide-react';

import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';

type Props = {
	/** The raw server code, or null when none was supplied. */
	code: string | null;
	/** The raw server sentence, verbatim. */
	rawMessage: string;
	/** Which action produced it, so support is not left guessing. */
	context: string;
};

/**
 * A3-C5-4: the diagnostic half of a Subject-mutation failure.
 *
 * The calm copy went to the toast; this keeps the OTHER half reachable. The
 * raw code and the raw server sentence are never discarded — they move behind
 * a labelled `@/ui` Popover, which is what AGENTS.md §8 requires (and forbids
 * the `title` attribute it replaces).
 *
 * This is the same arrangement `SubjectTermAuthorityBanner` uses for
 * `resolveTermAuthorityCopy`, and it is why the resolver can safely drop the
 * engineer string from the operator's screen: the sentence is delayed, not
 * lost.
 *
 * Renders nothing when the server supplied neither a code nor a message, so a
 * plain network failure adds no empty chrome to the page.
 */
export function SubjectMutationDetailPopover({ code, rawMessage, context }: Props) {
	if (!code && !rawMessage) return null;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					data-testid="subject-mutation-detail"
					aria-label={`Subject change details${code ? ` (${code})` : ''}`}
					className="h-6 gap-1 px-1.5 text-xs font-semibold text-primary hover:underline"
				>
					<Info className="size-3" />
					<span className="font-mono text-[0.65rem]">{code ?? 'Details'}</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80 space-y-2 p-3 text-xs leading-relaxed">
				<p className="font-semibold uppercase tracking-wide text-muted-foreground">Technical detail</p>
				{context ? <p><span className="font-semibold">Action</span> · {context}</p> : null}
				{code ? <p><span className="font-semibold">Code</span> · <span className="font-mono">{code}</span></p> : null}
				{rawMessage ? <p><span className="font-semibold">Server message</span> · {rawMessage}</p> : null}
				{!code && !rawMessage ? <p>No further technical detail was supplied.</p> : null}
			</PopoverContent>
		</Popover>
	);
}
