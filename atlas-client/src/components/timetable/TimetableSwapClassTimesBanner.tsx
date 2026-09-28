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
			className="border-b border-blue-200 bg-blue-50/80 px-3 py-2 text-sm"
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
