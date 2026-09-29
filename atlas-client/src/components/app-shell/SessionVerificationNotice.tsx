/**
 * A7-C5 — the ONE recovery surface for an unconfirmed sign-in.
 *
 * The requester's words: "After that, show one plain sentence that says what is
 * wrong, one Try again, and a safe way back to the dashboard."
 *
 * "COPY WHAT WORKS" (§11). This is the `rollover-awareness-notice` band in
 * `AppShell.tsx` — a full-width band under the header, one plain sentence, and
 * labelled `@/ui` buttons at `min-h-11` — because that is the best instance of
 * this pattern in the app. No new `@/ui` variant, no raw button, no `title`, no
 * `<details>`: this surface is a sibling of that one, not a local invention.
 *
 * WHY IT IS ITS OWN FILE, MOUNTED ONCE. The shell mounts this band; nothing
 * else in the tree does. `AdminYearSetup` renders NO panel of its own on a
 * deadline, because a second copy of the same sentence on that page is a defect
 * — one status per fact, one way forward. Extracting the band is what makes that
 * structural rather than a convention: a second mount has to import this file
 * and would be caught by the R4 row in `a7-c5-session-deadline.test.tsx`.
 */
import { RefreshCcw, LayoutDashboard } from 'lucide-react';

import { Button } from '@/ui/button';

/**
 * One sentence, in plain words, that says what is wrong AND that nothing was
 * thrown away. Without the second half, "Try again" reads as destructive and an
 * older scheduler will reach for the sign-out menu instead.
 */
export const SESSION_UNCONFIRMED_SENTENCE =
	'ATLAS could not confirm your sign-in in time, so this page is not ready yet — your sign-in was not cleared.';

export function SessionVerificationNotice({
	onRetry,
	onBackToDashboard,
}: {
	onRetry: () => void;
	onBackToDashboard: () => void;
}) {
	return (
		<section
			role='status'
			aria-live='polite'
			data-testid='session-verification-notice'
			className='flex flex-col gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between'
		>
			<p className='leading-relaxed'>{SESSION_UNCONFIRMED_SENTENCE}</p>
			<div className='flex flex-wrap gap-2'>
				<Button
					type='button'
					variant='outline'
					className='min-h-11 bg-white'
					data-testid='session-verification-retry'
					onClick={onRetry}
				>
					<RefreshCcw className='mr-1.5 size-4' aria-hidden='true' />
					Try again
				</Button>
				<Button
					type='button'
					variant='ghost'
					className='min-h-11'
					data-testid='session-verification-dashboard'
					onClick={onBackToDashboard}
				>
					<LayoutDashboard className='mr-1.5 size-4' aria-hidden='true' />
					Back to dashboard
				</Button>
			</div>
		</section>
	);
}
