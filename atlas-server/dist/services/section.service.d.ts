/**
 * Section service — Wave 5 Durable Mirroring
 * Bridges to section adapter and maintains a local SectionMirror
 * for high availability and local overrides.
 */
import { type SectionSummary } from './section-adapter.js';
export declare function syncSectionsFromExternal(schoolId: number, schoolYearId: number, authToken?: string): Promise<{
    synced: boolean;
    count: number;
    source: string;
    fetchedAt: Date;
}>;
export declare function getSectionSummary(schoolYearId: number, schoolId: number, authToken?: string): Promise<SectionSummary>;
