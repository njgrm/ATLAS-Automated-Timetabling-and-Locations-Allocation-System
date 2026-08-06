import { Save, Undo2 } from 'lucide-react';

import { Button } from '@/ui/button';

type TeachingLoadDraftActionBarProps = {
	activeDraftCount: number;
	canUndo: boolean;
	isReadOnlyMode: boolean;
	saving: boolean;
	statusMessage: string;
	writeBlockedReason: string | null;
	onUndo: () => void;
	onDiscard: () => void;
	onSave: () => void;
};

export function TeachingLoadDraftActionBar({
	activeDraftCount,
	canUndo,
	isReadOnlyMode,
	saving,
	statusMessage,
	writeBlockedReason,
	onUndo,
	onDiscard,
	onSave,
}: TeachingLoadDraftActionBarProps) {
	const saveDisabled = activeDraftCount === 0 || saving || isReadOnlyMode;

	return (
		<div className="shrink-0 border-t border-border/40 bg-background px-3 py-2" data-testid="teaching-load-draft-action-bar">
			<div className="flex flex-wrap items-center gap-2">
				<div className="min-w-0 flex-1">
					<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Draft status</p>
					<p className="truncate text-sm font-semibold text-foreground" aria-live="polite">{statusMessage}</p>
					{(isReadOnlyMode || activeDraftCount === 0) && (
						<p className="mt-1 text-xs font-medium text-muted-foreground" data-testid="teaching-load-draft-save-reason">
							{isReadOnlyMode ? writeBlockedReason : 'Save stays disabled until you prepare a draft change.'}
						</p>
					)}
				</div>
				<Button type="button" variant="outline" size="sm" className="h-9 gap-2 font-bold" onClick={onUndo} disabled={!canUndo || saving || isReadOnlyMode}>
					<Undo2 className="size-4" />
					Undo last
				</Button>
				<Button type="button" variant="outline" size="sm" className="h-9 font-bold" onClick={onDiscard} disabled={activeDraftCount === 0 || saving || isReadOnlyMode}>
					Discard draft
				</Button>
				<Button type="button" size="sm" className="h-9 gap-2 font-bold" onClick={onSave} disabled={saveDisabled}>
					<Save className="size-4" />
					{saving ? 'Saving...' : 'Save draft'}
				</Button>
			</div>
		</div>
	);
}
