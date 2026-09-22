import { CheckCircle2, Loader2, MapPin, ShieldAlert, X } from 'lucide-react';

import { Button } from '@/ui/button';
import type { InlinePlacementPreviewData } from '@/lib/timetable-inline-placement';

/**
 * B1 — the inline (never modal) preview-before-save for ordinary placement.
 *
 * It renders the consequence the operator is about to accept, plus exactly one
 * Confirm and one Cancel. It is a status region, not a dialog: focus is not
 * trapped and the grid stays usable. Undo remains the post-save affordance.
 */
export type { InlinePlacementPreviewData };

export type InlinePlacementPreviewProps = {
	pending: InlinePlacementPreviewData;
	saving?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
};

export function InlinePlacementPreview({ pending, saving = false, onConfirm, onCancel }: InlinePlacementPreviewProps) {
	const softLabel = pending.softCount > 0
		? `${pending.softCount} soft warning${pending.softCount === 1 ? '' : 's'}`
		: null;
	return (
		<section
			role="status"
			aria-live="polite"
			data-testid="inline-placement-preview"
			data-confirmable={pending.confirmable ? 'true' : 'false'}
			className="border-b border-primary/40 bg-primary/5 px-3 py-2 text-sm text-foreground"
		>
			<div className="flex min-w-0 items-start justify-between gap-3">
				<div className="flex min-w-0 items-start gap-2">
					{pending.confirmable ? (
						<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
					) : (
						<ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
					)}
					<div className="min-w-0">
						<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview before saving</p>
						<p className="min-w-0 text-sm" data-testid="inline-placement-preview-consequence">
							{pending.consequence}
						</p>
						<p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
							<MapPin className="size-3 shrink-0" aria-hidden="true" />
							<span className="truncate">
								{pending.sectionLabel} · {pending.subjectLabel} · session {pending.session}
								{pending.roomLabel ? ` · ${pending.roomLabel}` : ''}
								{softLabel ? ` · ${softLabel}` : ''}
							</span>
						</p>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Button
						type="button"
						size="sm"
						className="h-11 gap-1.5 px-3 text-sm"
						data-testid="inline-placement-confirm"
						disabled={!pending.confirmable || saving}
						onClick={onConfirm}
					>
						{saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
						Confirm
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-11 gap-1.5 px-3 text-sm"
						data-testid="inline-placement-cancel"
						disabled={saving}
						onClick={onCancel}
					>
						<X className="size-4" aria-hidden="true" />
						Cancel
					</Button>
				</div>
			</div>
		</section>
	);
}
