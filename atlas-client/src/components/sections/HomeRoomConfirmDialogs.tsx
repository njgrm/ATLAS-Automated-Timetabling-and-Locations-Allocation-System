/**
 * A3 S1 — the confirmation surface for a home-room write, and the only place
 * that decides when it closes.
 *
 * The defect this replaces: the caller fired the write and closed the dialog in
 * the same tick, so the dialog was gone before the outcome existed. A queued or
 * refused change looked exactly like a saved one, and the page-level notice it
 * did set sat behind the dialog. Here the confirm handler awaits the result,
 * the dialog stays mounted with a real in-flight state, and the result is
 * reported three ways that cannot be confused: a toast outside the dialog, an
 * in-modal state that names the true disposition, and a recovery path.
 *
 * A single in-flight ref guards the confirm control, so a second click while a
 * write is open dispatches nothing. Cancel never reaches the writer.
 */
import * as React from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import { SwapConfirmationModal, UnassignConfirmationModal } from './SectionHomeRoomModals';
import type { HomeRoomUpdateResult } from './homeRoomPersistence';
import type { SectionDetail } from './SectionRow';

export type PendingAssignment = {
	section: SectionDetail;
	roomId: number | null;
	type: 'unassign' | 'swap' | 'direct';
	displacedSection?: string;
	currentRoomName?: string | null;
	targetRoomName?: string;
};

export type HomeRoomConfirmDialogsProps = {
	pending: PendingAssignment;
	/** The live section list, used to resolve the swap partner. */
	sections: SectionDetail[];
	/**
	 * Runs the write and reports the final result. Never rejects. The swap
	 * partner is resolved by this component and handed over, so the escalation
	 * the user confirmed and the write that runs cannot drift apart.
	 */
	onRun: (
		pending: PendingAssignment,
		swapTarget?: { sectionId: number; homeRoomId: number | null },
	) => Promise<HomeRoomUpdateResult>;
	/** Closes without writing. */
	onClose: () => void;
};

function resultTone(status: HomeRoomUpdateResult['status']) {
	if (status === 'saved') return 'saved' as const;
	if (status === 'queued') return 'queued' as const;
	return 'failed' as const;
}

/**
 * The exact wording the user sees. A failed or queued write must never read as
 * saved, so "saved" appears only on the persisted result.
 */
export function homeRoomResultCopy(result: HomeRoomUpdateResult): { headline: string; detail: string } {
	if (result.status === 'saved') {
		return { headline: 'Home room saved', detail: 'The change is stored on the ATLAS server.' };
	}
	if (result.status === 'queued') {
		return {
			headline: 'Not on the server yet — queued on this device',
			detail: result.detail,
		};
	}
	return { headline: 'Change rejected — nothing was changed', detail: result.detail };
}

function ResultNotice({
	result,
	onRetry,
	onDismiss,
	busy,
}: {
	result: HomeRoomUpdateResult;
	onRetry: () => void;
	onDismiss: () => void;
	busy: boolean;
}) {
	const tone = resultTone(result.status);
	const copy = homeRoomResultCopy(result);
	return (
		<div
			role={tone === 'saved' ? 'status' : 'alert'}
			data-testid="home-room-result"
			data-result-status={result.status}
			className={cn(
				'mt-4 rounded-2xl border p-4 text-sm',
				tone === 'saved' && 'border-emerald-300 bg-emerald-50 text-emerald-900',
				tone === 'queued' && 'border-amber-300 bg-amber-50 text-amber-900',
				tone === 'failed' && 'border-destructive/40 bg-destructive/10 text-destructive',
			)}
		>
			<div className="flex items-start gap-2.5">
				{tone === 'saved' ? (
					<CheckCircle2 className="mt-0.5 size-5 shrink-0" />
				) : tone === 'queued' ? (
					<CloudOff className="mt-0.5 size-5 shrink-0" />
				) : (
					<AlertTriangle className="mt-0.5 size-5 shrink-0" />
				)}
				<div className="min-w-0 flex-1">
					<p className="font-bold" data-testid="home-room-result-headline">{copy.headline}</p>
					<p className="mt-0.5 leading-relaxed">{copy.detail}</p>
					{tone !== 'saved' ? (
						<div className="mt-3 flex flex-wrap gap-2">
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={onRetry}
								disabled={busy}
								data-testid="home-room-result-retry"
								className="h-9 gap-2 rounded-xl font-bold"
							>
								<RefreshCw className={cn('size-3.5', busy && 'animate-spin')} />
								Retry now
							</Button>
							{tone === 'queued' ? (
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={onDismiss}
									disabled={busy}
									data-testid="home-room-result-keep-queued"
									className="h-9 rounded-xl font-bold"
								>
									Keep queued
								</Button>
							) : null}
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onClick={onDismiss}
								disabled={busy}
								data-testid="home-room-result-dismiss"
								className="h-9 rounded-xl font-bold"
							>
								Dismiss
							</Button>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}

export function HomeRoomConfirmDialogs({ pending, sections, onRun, onClose }: HomeRoomConfirmDialogsProps) {
	const [inFlight, setInFlight] = React.useState(false);
	const [result, setResult] = React.useState<HomeRoomUpdateResult | null>(null);
	// A ref, not just state: two clicks in one tick must not both pass a
	// state check that has not re-rendered yet.
	const inFlightRef = React.useRef(false);
	const closedRef = React.useRef(false);

	// The swap partner is resolved from the live list here, not in the page, so
	// the escalation and the write it performs cannot drift apart.
	const swapTarget = React.useMemo(() => {
		if (pending.roomId == null) return undefined;
		const displaced = sections.find((s) => s.homeRoomId === pending.roomId);
		return displaced ? { sectionId: displaced.id, homeRoomId: pending.section.homeRoomId ?? null } : undefined;
	}, [pending, sections]);

	const run = React.useCallback(async () => {
		if (inFlightRef.current) return;
		inFlightRef.current = true;
		closedRef.current = false;
		setInFlight(true);
		try {
			const outcome = await onRun(pending, swapTarget);
			setResult(outcome);
			if (outcome.status === 'saved') {
				// The only outcome that closes by itself, and only after the
				// server has actually accepted the write.
				toast.success('Home room saved', {
					description: `${pending.section.name} now uses the selected home room.`,
				});
				closedRef.current = true;
				onClose();
			} else {
				toast.error(homeRoomResultCopy(outcome).headline, { description: outcome.detail });
			}
		} finally {
			inFlightRef.current = false;
			setInFlight(false);
		}
	}, [onClose, onRun, pending, swapTarget]);

	const resultPanel = result && !closedRef.current ? (
		<ResultNotice result={result} onRetry={() => { void run(); }} onDismiss={onClose} busy={inFlight} />
	) : null;

	return (
		<>
			<SwapConfirmationModal
				open={pending.type === 'swap'}
				onOpenChange={(open) => !open && !inFlightRef.current && onClose()}
				onConfirm={() => { void run(); }}
				sourceSectionName={pending.section.name}
				targetRoomName={pending.targetRoomName ?? ''}
				displacedSectionName={pending.displacedSection ?? ''}
				currentRoomName={pending.currentRoomName}
				isSaving={inFlight}
				confirmDisabled={result !== null}
				resultPanel={resultPanel}
				confirmLabel={swapTarget ? 'Confirm swap' : 'Confirm move'}
			/>
			<UnassignConfirmationModal
				open={pending.type === 'unassign'}
				onOpenChange={(open) => !open && !inFlightRef.current && onClose()}
				onConfirm={() => { void run(); }}
				sectionName={pending.section.name}
				currentRoomName={pending.currentRoomName ?? ''}
				isSaving={inFlight}
				confirmDisabled={result !== null}
				resultPanel={resultPanel}
			/>
		</>
	);
}
