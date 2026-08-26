import { Button } from '@/ui/button';

type BuildingGradeScopeControlProps = {
	gradeScope: number[];
	onGradeScopeChange: (gradeScope: number[]) => void;
};

const GRADE_OPTIONS = [
	{ value: 7, label: 'G7', color: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' },
	{ value: 8, label: 'G8', color: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200' },
	{ value: 9, label: 'G9', color: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' },
	{ value: 10, label: 'G10', color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' },
] as const;

export function BuildingGradeScopeControl({ gradeScope, onGradeScopeChange }: BuildingGradeScopeControlProps) {
	return (
		<div>
			<label className="text-[0.72rem] font-semibold text-slate-500">
				Grade scope
			</label>
			<p className="mt-0.5 mb-1.5 text-[0.6875rem] text-muted-foreground">
				Which grades can use rooms in this building.
			</p>
			<div className="flex flex-wrap gap-1.5">
				{GRADE_OPTIONS.map((g) => {
					const selected = (gradeScope ?? []).includes(g.value);
					return (
						<Button
							key={g.value}
							type="button"
							variant="outline"
							size="sm"
							className={`h-7 text-xs font-medium border transition-all ${
								selected
									? g.color + ' border-current'
									: 'border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
							}`}
							onClick={() => {
								const next = selected
									? gradeScope.filter((v) => v !== g.value)
									: [...gradeScope, g.value].sort((a, b) => a - b);
								onGradeScopeChange(next);
							}}
						>
							{g.label}
						</Button>
					);
				})}
			</div>
			{(!gradeScope || gradeScope.length === 0) && (
				<p className="mt-1 text-[0.6875rem] text-muted-foreground">
					Any grade (building is open to all grades)
				</p>
			)}
		</div>
	);
}
