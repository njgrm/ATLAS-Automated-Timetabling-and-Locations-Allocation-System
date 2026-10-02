import { useState } from 'react';

import { ViolationGroup } from '@/components/timetable/TimetableShared';
import { deriveSimplePublishReadiness } from '@/components/timetable/simplePublishReadiness';
import { formatIdentityFallbackText, formatWarningMessageText, VIOLATION_PRESENTATION } from '@/lib/violation-presentation';
import { MUST_FIX_LABEL } from '@/lib/timetable-plain-language';
import type { DraftReport, Violation, ViolationCode } from '@/types';

const placeholderCode = 'SYNTHETIC_PLACEHOLDER_OWNED' as unknown as ViolationCode;
const placeholderPresentation = VIOLATION_PRESENTATION[placeholderCode];

function unresolvedDraft(count: number): DraftReport {
	return {
		entries: [],
		unassignedItems: Array.from({ length: count }, (_, index) => ({
			sectionId: index + 1,
			subjectId: index + 1,
			gradeLevel: 7,
			session: 1,
			reason: 'NO_AVAILABLE_SLOT',
		})),
	} as unknown as DraftReport;
}

const label = (id: number) => `Class ${id}`;
const readiness = (hardCount: number) => deriveSimplePublishReadiness(
	unresolvedDraft(2),
	[],
	label,
	label,
	() => 'Teacher',
	{ blockingHardCount: hardCount, unassignedCount: 2, softCount: 0 },
);

const placeholderViolation: Violation = {
	code: placeholderCode,
	severity: 'SOFT',
	message: 'Faculty 16 is assigned on MONDAY.',
	schoolId: 1,
	schoolYearId: 1,
	runId: 1,
	entities: { facultyId: 16, day: 'MONDAY' },
};

function ReadinessCard({ title, hardCount }: { title: string; hardCount: number }) {
	const value = readiness(hardCount);
	return (
		<section className="rounded-lg border border-border bg-background p-5 shadow-sm" aria-label={title}>
			<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
			{hardCount > 0 && <p className="mt-3 text-sm font-semibold text-red-700">{MUST_FIX_LABEL} · {hardCount}</p>}
			<p className="mt-2 text-base leading-relaxed text-foreground">{value.blockerSentence}</p>
		</section>
	);
}

export function P06cR4VisualFixture() {
	const [, setSelectedViolation] = useState<Violation | null>(null);
	return (
		<main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-8 py-10 text-foreground">
			<header className="space-y-2">
				<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Local development fixture · p06c</p>
				<h1 className="text-2xl font-semibold">Warnings and publish readiness</h1>
			</header>
			<div className="grid gap-6 md:grid-cols-2">
				<section className="space-y-3" aria-label="Placeholder warning example">
					<h2 className="text-sm font-semibold">Warning</h2>
					<ViolationGroup
						code={placeholderCode}
						violations={[placeholderViolation]}
						selectedViolation={null}
						onSelect={setSelectedViolation}
						formatConstraintMessage={(message) => formatWarningMessageText(formatIdentityFallbackText(message))}
						labels={{ [placeholderCode]: placeholderPresentation.title } as Record<ViolationCode, string>}
					/>
					<p className="text-sm leading-relaxed text-muted-foreground">{placeholderPresentation.meaning} {placeholderPresentation.action}</p>
				</section>
				<div className="space-y-4">
					<ReadinessCard title="Unresolved classes" hardCount={0} />
					<ReadinessCard title="Must-fix problem and unresolved classes" hardCount={1} />
				</div>
			</div>
		</main>
	);
}

export const p06cR4FixtureInternals = { placeholderViolation, readiness };
