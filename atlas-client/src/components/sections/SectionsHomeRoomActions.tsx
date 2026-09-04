import { Wand2, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';

type SectionsHomeRoomActionsProps = {
	canAutoAssign: boolean;
	syncing: boolean;
	syncingQueuedEdits: boolean;
	stateStatus: string;
	isOnline: boolean;
	sectionsNeedingRooms: number;
	onAutoAssign: () => void;
	onSync: () => void;
};

export function SectionsHomeRoomActions({
	canAutoAssign,
	syncing,
	syncingQueuedEdits,
	stateStatus,
	isOnline,
	sectionsNeedingRooms,
	onAutoAssign,
	onSync,
}: SectionsHomeRoomActionsProps) {
	return (
		<div className="flex shrink-0 items-center gap-2">
			{canAutoAssign && (
				<Button variant="default" size="sm" onClick={onAutoAssign} className="gap-2 shadow-sm font-bold">
					<Wand2 className="size-4" />
					<span className="hidden sm:inline">Auto-assign rooms</span>
					<span className="sm:hidden">Auto</span>
				</Button>
			)}
			{sectionsNeedingRooms > 0 && (
				<Popover>
					<PopoverTrigger asChild>
						<Badge
							variant="outline"
							className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer gap-1.5 px-2.5 py-1 rounded-full font-semibold shadow-sm"
							data-testid="sections-start-here-banner"
							onClick={onAutoAssign}
						>
							<MapPin className="size-3" />
							<span className="hidden sm:inline">{sectionsNeedingRooms} need{sectionsNeedingRooms === 1 ? 's' : ''} rooms</span>
							<span className="sm:hidden">{sectionsNeedingRooms}</span>
						</Badge>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-72 rounded-xl p-3 text-sm">
						<p className="font-semibold text-slate-900">Sections needing home rooms</p>
						<p className="mt-1 text-xs leading-relaxed text-slate-600">
							Use &quot;Auto-assign rooms&quot; or the &quot;Choose home room&quot; control on each row.
						</p>
					</PopoverContent>
				</Popover>
			)}
			<Button variant="outline" size="sm" onClick={onSync} disabled={syncing || syncingQueuedEdits || stateStatus === 'loading' || !isOnline} className="gap-2 shadow-sm font-bold">
				<RefreshCw className={`size-4 ${syncing || syncingQueuedEdits ? 'animate-spin' : ''}`} />
				<span className="hidden sm:inline">{syncing || syncingQueuedEdits ? 'Syncing...' : !isOnline ? 'Offline' : 'Sync sections'}</span>
				<span className="sm:hidden">{syncing || syncingQueuedEdits ? '' : 'Sync'}</span>
			</Button>
		</div>
	);
}
