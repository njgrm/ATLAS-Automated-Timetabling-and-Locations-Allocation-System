import { Input } from '@/ui/input';
import { PolicySwitch } from '@/components/scheduling-policy/PolicyPanePrimitives';

export type FlagHgpOverlayDraft = {
	gradeGroup: '7-8' | '9-10';
	enabled: boolean;
	startTime: string;
	endTime: string;
};

export const DEFAULT_FLAG_HGP_OVERLAYS: FlagHgpOverlayDraft[] = [
	{ gradeGroup: '7-8', enabled: false, startTime: '06:45', endTime: '07:30' },
	{ gradeGroup: '9-10', enabled: false, startTime: '12:15', endTime: '13:00' },
];

export function projectFlagHgpOverlays(events: Array<{
	eventType: string;
	gradeGroup: string | null;
	programType: string | null;
	startTime: string;
	endTime: string;
	enabled: boolean;
}>): FlagHgpOverlayDraft[] {
	return DEFAULT_FLAG_HGP_OVERLAYS.map((fallback) => {
		const row = events.find((event) => event.eventType === 'FLAG_OR_HGP'
			&& event.gradeGroup === fallback.gradeGroup && event.programType == null);
		return row
			? { gradeGroup: fallback.gradeGroup, enabled: row.enabled, startTime: row.startTime, endTime: row.endTime }
			: { ...fallback };
	});
}

export function FlagHgpOverlaySettings({
	value,
	onChange,
}: {
	value: FlagHgpOverlayDraft[];
	onChange: (next: FlagHgpOverlayDraft[]) => void;
}) {
	return (
		<section aria-label="Flag and HGP times" className="space-y-3">
			<div className="space-y-0.5">
				<h3 className="text-sm font-medium text-foreground">Monday Flag / HGP</h3>
				<p className="text-xs text-muted-foreground">Each time sits over its class period; it does not add a class.</p>
			</div>
			{value.map((row, index) => {
				const gradeLabel = row.gradeGroup === '7-8' ? 'Grades 7–8' : 'Grades 9–10';
				const update = (patch: Partial<FlagHgpOverlayDraft>) => {
					const next = value.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
					onChange(next);
				};
				return (
					<div key={row.gradeGroup} className="space-y-2 rounded-md border border-border/60 px-3 py-2">
						<PolicySwitch
							label={`${row.gradeGroup === '7-8' ? 'Morning' : 'Afternoon'} Flag / HGP (${gradeLabel})`}
							explanation={`Show the Monday Flag / HGP overlay within a ${gradeLabel} class period.`}
							checked={row.enabled}
							onCheckedChange={(enabled) => update({ enabled })}
						/>
						<div className="grid grid-cols-2 gap-3">
							<label className="space-y-1 text-xs text-muted-foreground">
								<span>Start</span>
								<Input aria-label={`${gradeLabel} Flag / HGP start`} type="time" className="h-8 text-xs" value={row.startTime} onChange={(event) => update({ startTime: event.target.value })} />
							</label>
							<label className="space-y-1 text-xs text-muted-foreground">
								<span>End</span>
								<Input aria-label={`${gradeLabel} Flag / HGP end`} type="time" className="h-8 text-xs" value={row.endTime} onChange={(event) => update({ endTime: event.target.value })} />
							</label>
						</div>
					</div>
				);
			})}
		</section>
	);
}
