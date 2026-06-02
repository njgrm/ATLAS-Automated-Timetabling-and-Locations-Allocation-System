import type { GenerationGateStatus } from '@/types';

type RoomRequestAdvisory = {
	title: string;
	message: string;
	variant: 'info' | 'warning';
};

export function buildRoomRequestAdvisory({
	cachedBootstrapAt,
	gate,
	online,
	outboxCount,
	usingCachedBootstrap,
}: {
	cachedBootstrapAt: string | null;
	gate: GenerationGateStatus | null;
	online: boolean;
	outboxCount: number;
	usingCachedBootstrap: boolean;
}): RoomRequestAdvisory {
	if (outboxCount > 0) {
		return {
			title: 'Some requests are waiting to send',
			message: online
				? `${outboxCount} request${outboxCount === 1 ? ' is' : 's are'} waiting to send. Keep this page open while ATLAS checks for updates.`
				: `${outboxCount} request${outboxCount === 1 ? ' is' : 's are'} waiting to send when your connection returns.`,
			variant: 'warning',
		};
	}

	if (usingCachedBootstrap) {
		const savedAt = cachedBootstrapAt ? new Date(cachedBootstrapAt).toLocaleString() : null;
		return {
			title: 'Showing latest saved requests',
			message: savedAt
				? `Waiting for connection. Showing the request view saved on this device from ${savedAt}.`
				: 'Waiting for connection. Showing the request view saved on this device.',
			variant: 'warning',
		};
	}

	if (gate?.blocked) {
		return {
			title: 'Requests are paused',
			message: `Please complete ${gate.openCount} open items before submitting more.`,
			variant: 'warning',
		};
	}

	return {
		title: 'Checking for updates',
		message: 'Free slots create move requests. Occupied slots create swap requests for scheduler decision.',
		variant: 'info',
	};
}
