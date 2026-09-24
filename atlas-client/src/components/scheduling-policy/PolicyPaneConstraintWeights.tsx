/**
 * Per-Constraint Weights column of the Scheduling Policy pane.
 *
 * Extracted verbatim from `SchedulingPolicyPane.tsx` (AGENTS.md §8 1000-line
 * cap). Pure extraction: the same controls, copy, props and behaviour.
 */

import type { ConstraintOverride, ViolationCode } from '@/types';
import {
	ConstraintRow,
	DEFAULT_CONSTRAINT_CONFIG,
	SectionCard,
	SOFT_CONSTRAINT_LABELS,
} from '@/components/scheduling-policy/PolicyPanePrimitives';
import { isPublicationBlockingCode } from '@/components/timetable/simplePublishReadiness';
import type { LocalPolicy } from '@/components/scheduling-policy/policyPaneModel';

export function PolicyPaneConstraintWeights({
	local,
	updateConstraint,
}: {
	local: LocalPolicy;
	updateConstraint: (code: string, field: keyof ConstraintOverride, value: unknown) => void;
}) {
	return (
		<SectionCard title="Schedule preferences">
			<p className="text-[0.6875rem] text-muted-foreground">
				Mark a rule Preferred or Required. Priority strength is Low, Standard, or High. These choices guide future schedules and revisions; they never silently change a published schedule.
			</p>
			<div className="space-y-2">
				{Object.entries(SOFT_CONSTRAINT_LABELS).map(([code, info]) => {
					const cfg = local.constraintConfig[code] ?? DEFAULT_CONSTRAINT_CONFIG[code];
					return (
						<ConstraintRow
							key={code}
							code={code as ViolationCode}
							label={info.label}
							explanation={info.explanation}
							config={cfg}
							promotable={isPublicationBlockingCode(code)}
							onToggleEnabled={(v) => updateConstraint(code, 'enabled', v)}
							onWeightChange={(v) => updateConstraint(code, 'weight', v)}
							onToggleTreatAsHard={(v) => updateConstraint(code, 'treatAsHard', v)}
						/>
					);
				})}
			</div>
		</SectionCard>
	);
}
