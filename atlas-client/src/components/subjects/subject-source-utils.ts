import type { AdminSourceState } from '@/components/admin-workspace/AdminWorkspace';

export function resolveSubjectSourceCopy(sourceState: AdminSourceState) {
	return {
		description:
			sourceState === 'verified-live'
				? 'The curriculum subject list is loaded for the active school year.'
			: sourceState === 'checking-source'
				? 'ATLAS is checking which subjects and program offerings should be active while the page stays usable.'
			: sourceState === 'saved-data'
				? 'ATLAS is showing the last known curriculum list while offering verification is incomplete.'
			: 'ATLAS could not load a usable subject catalog.',
		nextAction:
			sourceState === 'verified-live'
				? 'Open coverage for subjects with risk, or add a subject if the curriculum list is missing one.'
			: sourceState === 'checking-source'
				? 'Keep reviewing subjects and wait before final curriculum changes.'
			: sourceState === 'saved-data'
				? 'Refresh offerings before treating this as final curriculum truth.'
			: 'Reconnect and sync subjects before this page can be used.',
	};
}
