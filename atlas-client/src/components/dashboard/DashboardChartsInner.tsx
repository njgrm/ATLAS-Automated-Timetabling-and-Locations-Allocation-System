import {
	PieChart,
	Pie,
	Cell,
	Tooltip,
	ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

type RunHealthDonutProps = {
	assignedCount: number | null;
	unassignedCount: number | null;
	hardViolationCount: number | null;
	latestRunStatus: string;
	loading: boolean;
};

export function RunHealthDonut({ assignedCount, unassignedCount, hardViolationCount, latestRunStatus, loading }: RunHealthDonutProps) {
	if (loading) {
		return <div className='h-[180px] flex items-center justify-center text-sm text-muted-foreground'>Loading...</div>;
	}

	if (latestRunStatus === 'NONE') {
		return (
			<div className='h-[180px] flex flex-col items-center justify-center text-sm text-muted-foreground'>
				<AlertTriangle className='size-8 mb-2 opacity-50' />
				<p>No current-year run yet</p>
			</div>
		);
	}

	const assigned = assignedCount ?? 0;
	const unassigned = unassignedCount ?? 0;
	const violations = hardViolationCount ?? 0;
	const total = assigned + unassigned + violations;

	if (total === 0) {
		return (
			<div className='h-[180px] flex flex-col items-center justify-center text-sm text-muted-foreground'>
				<CheckCircle2 className='size-8 mb-2 opacity-50' />
				<p>No session data available</p>
			</div>
		);
	}

	const data = [
		{ name: 'Assigned', value: assigned, fill: '#22c55e' },
		{ name: 'Unassigned', value: unassigned, fill: '#eab308' },
		{ name: 'Hard violations', value: violations, fill: '#ef4444' },
	].filter((item) => item.value > 0);

	return (
		<div className='flex flex-col items-center'>
			<ResponsiveContainer width='100%' height={150}>
				<PieChart>
					<Pie
						data={data}
						cx='50%'
						cy='50%'
						innerRadius={40}
						outerRadius={60}
						paddingAngle={2}
						dataKey='value'
					>
						{data.map((entry, index) => (
							<Cell key={`cell-${index}`} fill={entry.fill} />
						))}
					</Pie>
					<Tooltip content={<GlowTooltip />} />
				</PieChart>
			</ResponsiveContainer>
			<div className='flex flex-wrap justify-center gap-3 text-xs text-muted-foreground mt-2'>
				<div className='flex items-center gap-1.5'>
					<div className='size-2 rounded-full bg-green-500' />
					<span>Assigned ({assigned})</span>
				</div>
				<div className='flex items-center gap-1.5'>
					<div className='size-2 rounded-full bg-yellow-500' />
					<span>Unassigned ({unassigned})</span>
				</div>
				{violations > 0 && (
					<div className='flex items-center gap-1.5'>
						<div className='size-2 rounded-full bg-red-500' />
						<span>Violations ({violations})</span>
					</div>
				)}
			</div>
		</div>
	);
}

function GlowTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
	if (!active || !payload?.length) return null;

	return (
		<div className='rounded-xl border border-border bg-foreground/95 px-3 py-2 text-xs text-background shadow-lg'>
			{label && <p className='font-bold mb-1'>{label}</p>}
			{payload.map((entry, index) => (
				<p key={index} className='flex items-center gap-2'>
					<span className='font-medium'>{entry.name}:</span>
					<span className='font-bold'>{entry.value}</span>
				</p>
			))}
		</div>
	);
}
