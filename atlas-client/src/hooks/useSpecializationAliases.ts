import { useEffect, useState } from 'react';

import atlasApi from '@/lib/api';
import type { SpecializationAlias } from '@/types';

interface UseSpecializationAliasesResult {
	aliases: SpecializationAlias[];
	loading: boolean;
}

/**
 * Fetches and caches the SpecializationAlias catalog for the given school.
 * Designed to be called once per page mount; the result is stable after the
 * first successful fetch and does not re-fetch on re-render.
 */
export function useSpecializationAliases(schoolId: number): UseSpecializationAliasesResult {
	const [aliases, setAliases] = useState<SpecializationAlias[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		atlasApi
			.get<{ aliases: SpecializationAlias[] }>('/specialization-aliases', {
				params: { schoolId },
			})
			.then(({ data }) => {
				if (!cancelled) {
					setAliases(data.aliases ?? []);
				}
			})
			.catch(() => {
				// Alias catalog is non-critical; silently degrade to legacy tiers
				if (!cancelled) {
					setAliases([]);
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [schoolId]);

	return { aliases, loading };
}
