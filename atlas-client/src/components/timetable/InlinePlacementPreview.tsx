import { CheckCircle2, Loader2, MapPin, ShieldAlert, X } from 'lucide-react';

import { Button } from '@/ui/button';
import { SearchableSelect } from '@/ui/searchable-select';
import type { InlinePlacementPreviewData } from '@/lib/timetable-inline-placement';

/**
 * B1 — the inline (never modal) preview-before-save for ordinary placement.
 *
 * It renders the consequence the operator is about to accept, plus exactly one
 * Confirm and one Cancel. It is a status region, not a dialog: focus is not
 * trapped and the grid stays usable. The room stays choosable right here, so no
 * modal is needed to change it. Undo remains the post-save affordance.
 */
export type { InlinePlacementPreviewData };

export type InlinePlacementPreviewProps = {
	pending: InlinePlacementPreviewData;
	saving?: boolean;
	/** The room the pending consequence would save. */
	roomId: number | null;
	/** Teaching-space options for the inline room chooser. */
	roomOptions?: ReadonlyArray<{ value: string; label: string }>;
	roomChanging?: boolean;
	onRoomChange?: (roomId: string) => void;
	onConfirm: () => void;
	onCancel: () => void;
};

export function InlinePlacementPreview({
	pending,
	saving = false,
	roomId,
	roomOptions = [],
	roomChanging = false,
	onRoomChange,
	onConfirm,
	onCancel,
}: InlinePlacementPreviewProps) {
	const softLabel = pending.softCount > 0
		? `${pending.softCount} soft warning${pending.softCount === 1 ? '' : 's'}`
		: null;
	const canChooseRoom = Boolean(onRoomChange) && roomOptions.length > 1;
	return (
		<section
			aria-label="Preview before saving"
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
						<p
							role="status"
							aria-live="polite"
							className="min-w-0 text-sm"
							data-testid="inline-placement-preview-consequence"
						>
							{pending.consequence}
						</p>
						<div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
							<span className="flex min-w-0 items-center gap-1">
								<MapPin className="size-3 shrink-0" aria-hidden="true" />
								<span className="truncate">
									{pending.sectionLabel} · {pending.subjectLabel} · session {pending.session}
									{softLabel ? ` · ${softLabel}` : ''}
								</span>
							</span>
							{canChooseRoom ? (
								<span className="flex min-w-0 items-center gap-1.5" data-testid="inline-placement-room-picker">
									<span className="shrink-0 font-medium text-foreground/80">Room:</span>
									<SearchableSelect
										items={[...roomOptions]}
										value={roomId != null ? String(roomId) : ''}
										onValueChange={(value) => onRoomChange?.(value)}
										placeholder="Choose a room"
										disabled={saving || roomChanging}
										triggerClassName="h-7 min-w-[11rem] max-w-[16rem] text-xs"
									/>
									{roomChanging ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
								</span>
							) : pending.roomLabel ? (
								<span className="truncate">· {pending.roomLabel}</span>
							) : null}
						</div>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Button
						type="button"
						size="sm"
						className="h-11 gap-1.5 px-3 text-sm"
						data-testid="inline-placement-confirm"
						disabled={!pending.confirmable || saving || roomChanging}
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
