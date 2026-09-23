import { prisma } from '../lib/prisma.js';

export type LearnerCounts = { male: number; female: number; total: number };

export class LearnerReconciliationError extends Error {
	readonly statusCode = 503;
	readonly code = 'LEARNER_RECONCILIATION_FAILED';

	constructor() {
		super('Current EnrollPro learner totals could not be verified against the section roster. No class workbook was produced.');
		this.name = 'LearnerReconciliationError';
	}
}

type LearnerPage = {
	data?: unknown[];
	meta?: { total?: number; totalPages?: number };
};

/** Read current EnrollPro learner sex totals without retaining learner records. */
export async function aggregateSectionLearnerCounts(input: {
	schoolId: number;
	schoolYearId: number;
	sectionIds: number[];
	authToken?: string;
	fetchImpl?: typeof fetch;
	client?: any;
}): Promise<Map<number, LearnerCounts>> {
	const uniqueIds = [...new Set(input.sectionIds)];
	if (uniqueIds.some((id) => !Number.isInteger(id) || id <= 0)) throw new LearnerReconciliationError();
	if (uniqueIds.length === 0) return new Map();

	const db = (input.client ?? prisma) as typeof prisma;
	const mirrors = await db.sectionMirror.findMany({
		where: { schoolId: input.schoolId, schoolYearId: input.schoolYearId, externalId: { in: uniqueIds }, isStale: false },
		select: { externalId: true, enrolledCount: true },
	});
	const expected = new Map<number, number>(mirrors.map((row: any) => [row.externalId, row.enrolledCount]));
	if (expected.size !== uniqueIds.length || uniqueIds.some((id) => !Number.isInteger(expected.get(id)) || (expected.get(id) ?? -1) < 0)) {
		throw new LearnerReconciliationError();
	}

	const baseUrl = (process.env.ENROLLPRO_API ?? 'http://localhost:5000/api').replace(/\/+$/, '');
	const token = input.authToken ?? process.env.ENROLLPRO_SERVICE_TOKEN;
	if (!token) throw new LearnerReconciliationError();
	const fetchImpl = input.fetchImpl ?? fetch;
	const result = new Map<number, LearnerCounts>();

	for (const sectionId of uniqueIds) {
		let pageNumber = 1;
		let totalPages: number | null = null;
		let reportedTotal: number | null = null;
		let seen = 0;
		let male = 0;
		let female = 0;
		while (totalPages === null || pageNumber <= totalPages) {
			const url = `${baseUrl}/integration/v1/sections/${sectionId}/learners?schoolYearId=${input.schoolYearId}&page=${pageNumber}&limit=200`;
			const response = await fetchImpl(url, {
				headers: { Authorization: `Bearer ${token}` },
				signal: AbortSignal.timeout(10000),
			});
			if (!response.ok) throw new LearnerReconciliationError();
			const payload = await response.json() as LearnerPage;
			if (!Array.isArray(payload.data)) throw new LearnerReconciliationError();
			const pageTotal = Number(payload.meta?.total);
			const pageCount = Number(payload.meta?.totalPages);
			if (!Number.isInteger(pageTotal) || pageTotal < 0 || !Number.isInteger(pageCount) || pageCount < 0) {
				throw new LearnerReconciliationError();
			}
			if (reportedTotal !== null && reportedTotal !== pageTotal) throw new LearnerReconciliationError();
			if (totalPages !== null && totalPages !== pageCount) throw new LearnerReconciliationError();
			reportedTotal = pageTotal;
			totalPages = pageCount;
			for (const item of payload.data) {
				const sex = (item as { learner?: { sex?: unknown } } | null)?.learner?.sex;
				if (sex === 'M') male += 1;
				else if (sex === 'F') female += 1;
				else throw new LearnerReconciliationError();
				seen += 1;
			}
			if (pageCount === 0 || pageNumber >= pageCount) break;
			pageNumber += 1;
		}
		const total = reportedTotal ?? -1;
		if (seen !== total || male + female !== total || total !== expected.get(sectionId)) {
			throw new LearnerReconciliationError();
		}
		result.set(sectionId, { male, female, total });
	}
	return result;
}
