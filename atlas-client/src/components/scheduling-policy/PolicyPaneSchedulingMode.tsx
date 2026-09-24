/**
 * Scheduling Mode column of the Scheduling Policy pane.
 *
 * Extracted verbatim from `SchedulingPolicyPane.tsx` (AGENTS.md §8 1000-line
 * cap). Pure extraction: the same controls, copy, props and behaviour.
 */

import { Label } from '@/ui/label';
import { Switch } from '@/ui/switch';
import { PolicyNumberField, SectionCard } from '@/components/scheduling-policy/PolicyPanePrimitives';
import type { LocalPolicy, UpdateLocalPolicy } from '@/components/scheduling-policy/policyPaneModel';

export function PolicyPaneSchedulingMode({ local, update }: { local: LocalPolicy; update: UpdateLocalPolicy }) {
	return (
		<SectionCard title="Scheduling Mode">
			<div className="space-y-3">
				<div className="grid grid-cols-2 gap-3">
					<PolicyNumberField
						label="Block Length (min)"
						explanation="Length of one generated timetable block. This controls session normalization and the visible timetable slot grid."
						value={local.periodLengthMinutes}
						onChange={(v) => update('periodLengthMinutes', v)}
						min={30}
						max={90}
					/>
					<PolicyNumberField
						label="Periods Per Day"
						explanation="Maximum schedulable blocks in one day before protected breaks and special events are applied."
						value={local.periodsPerDay}
						onChange={(v) => update('periodsPerDay', v)}
						min={4}
						max={12}
					/>
				</div>
				<div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2">
					<div className="space-y-0.5">
						<Label className="font-medium text-xs text-foreground">Teacher's Move</Label>
						<p className="text-[0.6875rem] text-muted-foreground leading-relaxed">
							{local.teacherMoveEnabled
								? 'Teachers can move between buildings for classes.'
								: 'Teachers stay within their assigned building context.'}
						</p>
					</div>
					<Switch
						checked={local.teacherMoveEnabled}
						onCheckedChange={(checked) => update('teacherMoveEnabled', checked)}
					/>
				</div>
				<div className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-2 text-[0.6875rem] text-sky-700 leading-relaxed">
					Full-day fidelity uses 45-minute blocks with protected lunch, recess, and special-event windows. Shift-window overrides are in the Shift Settings tab.
				</div>
			</div>
		</SectionCard>
	);
}
