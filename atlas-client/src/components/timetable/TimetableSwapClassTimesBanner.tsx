/**
 * C11 M4 — the armed-swap banner, extracted from `TimetableSimpleHeader.tsx`.
 *
 * `TimetableSimpleHeader` was at 959 physical lines against the 1000-line cap
 * (AGENTS.md §8) and had to take the persistent draft strip, so this block moved
 * out rather than growing that file.
 *
 * The banner is the ONE visible signal that a two-class swap is half-armed, and it
 * is also one of the two surfaces whose Cancel must run the single reset
 * (`timetableSwapArming.resetSwapClassTimes`). Its own wording is unchanged.
 *
 * A2 C12 / ITEM H — `shrink-0` is new, and it is a consequence of the MOVE rather
 * than a redesign. The banner used to be a child of the `shrink-0` `<header>`, so
 * it could never be compressed. It is now a sibling of that header in the
 * workspace's own `flex flex-col h-[calc(100svh-3.5rem)]` column, where a
 * shrinkable sibling CAN be compressed by vertical pressure. `shrink-0` restores
 * exactly the behaviour it had inside the header, so an armed swap stays visible.
 * Nothing else about the banner changed: same words, same testids, same
 * `role="status"`, same single-reset Cancel.
 */
import { Button } from '@/ui/button';

export function TimetableSwapClassTimesBanner({
	mode,
	onCancel,
}: {
	mode: 'select-first' | 'select-second';
	onCancel: () => void;
}) {
	return (
		<div
			role="status"
			aria-live="polite"
			data-testid="timetable-swap-class-times-banner"
			className="shrink-0 border-b border-blue-200 bg-blue-50/80 px-3 py-2 text-sm"
		>
			<div className="flex items-center justify-between gap-2">
				<p className="min-w-0 truncate">
					{mode === 'select-first' ? (
						<span className="text-blue-900"><span className="font-bold">Swap class times:</span> choose Class A on the grid.</span>
					) : (
						<span className="text-blue-900"><span className="font-bold">Swap class times:</span> Class A selected. Choose Class B on the grid.</span>
					)}
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-11 shrink-0 gap-1.5 px-3 text-sm"
					data-testid="timetable-swap-class-times-cancel"
					onClick={onCancel}
				>
					Cancel
				</Button>
			</div>
		</div>
	);
}
