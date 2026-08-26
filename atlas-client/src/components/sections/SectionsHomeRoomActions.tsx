import { Wand2, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/ui/button';

type SectionsHomeRoomActionsProps = {
	canAutoAssign: boolean;
	sectionsNeedingRooms: number;
	syncing: boolean;
	syncingQueuedEdits: boolean;
	stateStatus: string;
	isOnline: boolean;
	onAutoAssign: () => void;
	onSync: () => void;
};

export function SectionsHomeRoomActions({
	canAutoAssign,
	sectionsNeedingRooms,
	syncing,
	syncingQueuedEdits,
	stateStatus,
	isOnline,
	onAutoAssign,
	onSync,
}: SectionsHomeRoomActionsProps) {
	return (
		<>
			{/* Primary actions */}
			<div className="flex gap-2">
				{canAutoAssign && (
					<Button variant="default" size="sm" onClick={onAutoAssign} className="gap-2 shadow-sm font-bold">
						<Wand2 className="size-4" />
						<span className="hidden sm:inline">Auto-assign rooms</span>
						<span className="sm:hidden">Auto</span>
					</Button>
				)}
				<Button variant="outline" size="sm" onClick={onSync} disabled={syncing || syncingQueuedEdits || stateStatus === 'loading' || !isOnline} className="gap-2 shadow-sm font-bold">
					<RefreshCw className={`size-4 ${syncing || syncingQueuedEdits ? 'animate-spin' : ''}`} />
					<span className="hidden sm:inline">{syncing || syncingQueuedEdits ? 'Syncing...' : !isOnline ? 'Offline' : 'Sync sections'}</span>
					<span className="sm:hidden">{syncing || syncingQueuedEdits ? '' : 'Sync'}</span>
				</Button>
			</div>

			{/* Start-here banner */}
			{sectionsNeedingRooms > 0 ? (
				<div
					role="status"
					data-testid="sections-start-here-banner"
					className="shrink-0 mx-4 mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm text-primary shadow-sm lg:mx-5"
				>
					<MapPin className="size-4 shrink-0" />
					<span className="flex-1 font-semibold">
						{sectionsNeedingRooms} {sectionsNeedingRooms === 1 ? 'section needs' : 'sections need'} a home room. Use "Auto-assign rooms" or the "Choose home room" control on each row.
					</span>
				</div>
			) : null}
		</>
	);
}
