import type { AdminSourceState } from '@/components/admin-workspace/AdminWorkspace';

export function resolveSubjectSourceCopy(sourceState: AdminSourceState) {
	return {
		description:
			sourceState === 'verified-live'
				? 'ATLAS is showing the saved subject catalog for this school.'
			: sourceState === 'checking-source'
				? 'ATLAS is loading the subject catalog for this school.'
			: sourceState === 'saved-data'
				? 'ATLAS is showing the saved subject catalog for this school.'
			: 'ATLAS could not load a usable subject catalog.',
		nextAction:
			sourceState === 'verified-live'
				? 'Open coverage for subjects with risk, or add a subject if the catalog is missing one.'
			: sourceState === 'checking-source'
				? 'Wait for the catalog to load before making curriculum changes.'
			: sourceState === 'saved-data'
				? 'Add a subject if the catalog is missing one, or open coverage for subjects at risk.'
			: 'Check the school connection, then retry loading the catalog.',
	};
}
