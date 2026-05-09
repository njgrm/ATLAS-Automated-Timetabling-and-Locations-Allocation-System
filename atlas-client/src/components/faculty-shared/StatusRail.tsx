import { Activity, RefreshCcw, Wifi, WifiOff } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';

type SyncState = 'idle' | 'queued-offline' | 'syncing' | 'queued' | 'failed' | 'synced';

type StatusRailProps = {
	online: boolean;
	syncState: SyncState;
	queuedCount?: number;
	failedCount?: number;
	lastSyncedAt?: string | null;
	liveViewers?: number;
	liveUpdates?: number;
	realtimeConnected?: boolean;
	realtimeError?: string | null;
	onRetryFailed?: () => void;
};

function syncLabel(syncState: SyncState, queuedCount: number, failedCount: number, lastSyncedAt?: string | null) {
	if (syncState === 'queued-offline') return 'Queued offline - waiting for connection.';
	if (syncState === 'syncing') return 'Syncing queued changes.';
	if (syncState === 'queued') return `Queued - ${queuedCount} change${queuedCount !== 1 ? 's' : ''} waiting to sync.`;
	if (syncState === 'failed') return `Failed - ${failedCount} change${failedCount !== 1 ? 's' : ''} need retry.`;
	if (syncState === 'synced' && lastSyncedAt) {
		return `Synced - last update ${new Date(lastSyncedAt).toLocaleTimeString()}.`;
	}
	return 'Connected.';
}

export default function StatusRail({
	online,
	syncState,
	queuedCount = 0,
	failedCount = 0,
	lastSyncedAt,
	liveViewers = 0,
	liveUpdates = 0,
	realtimeConnected,
	realtimeError,
	onRetryFailed,
}: StatusRailProps) {
	return (
		<div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs ${online ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
			{online ? <Wifi className='size-4 shrink-0' /> : <WifiOff className='size-4 shrink-0' />}
			<span className='font-semibold'>{syncLabel(syncState, queuedCount, failedCount, lastSyncedAt)}</span>
			{syncState === 'failed' && onRetryFailed && (
				<Button size='sm' variant='outline' className='h-6 px-2 text-xs' onClick={onRetryFailed}>
					<RefreshCcw className='mr-1 size-3.5' /> Retry
				</Button>
			)}
			{liveViewers > 0 && <Badge variant='outline'>{liveViewers} viewer{liveViewers !== 1 ? 's' : ''}</Badge>}
			{liveUpdates > 0 && <Badge variant='secondary'>{liveUpdates} new update{liveUpdates !== 1 ? 's' : ''}</Badge>}
			{typeof realtimeConnected === 'boolean' && (
				<Badge variant={realtimeConnected ? 'success' : 'warning'} className='gap-1'>
					<Activity className='size-3' /> {realtimeConnected ? 'Realtime connected' : 'Realtime reconnecting'}
				</Badge>
			)}
			{realtimeError && <span className='text-destructive'>{realtimeError}</span>}
		</div>
	);
}
