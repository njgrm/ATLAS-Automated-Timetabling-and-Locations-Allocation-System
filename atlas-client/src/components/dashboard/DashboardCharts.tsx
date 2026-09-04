import { lazy, Suspense } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

const RunHealthDonut = lazy(() => import('./DashboardChartsInner').then((module) => ({ default: module.RunHealthDonut })));

type DashboardChartsProps = {
	loading: boolean;
	assignedCount: number | null;
	unassignedCount: number | null;
	hardViolationCount: number | null;
	latestRunStatus: string;
};

function ChartSkeleton() {
	return (
		<div className='space-y-3'>
			<Skeleton className='h-4 w-32' />
			<Skeleton className='h-[180px] w-full rounded-lg' />
		</div>
	);
}

export function DashboardCharts(props: DashboardChartsProps) {
	return (
		<Card className='shadow-primary-glow-soft'>
			<CardHeader className='pb-2'>
				<CardTitle className='text-sm font-bold flex items-center gap-2'>
					<CheckCircle2 className='size-4 text-primary' />
					Run Health
				</CardTitle>
			</CardHeader>
			<CardContent>
				<Suspense fallback={<ChartSkeleton />}>
					<RunHealthDonut
						assignedCount={props.assignedCount}
						unassignedCount={props.unassignedCount}
						hardViolationCount={props.hardViolationCount}
						latestRunStatus={props.latestRunStatus}
						loading={props.loading}
					/>
				</Suspense>
			</CardContent>
		</Card>
	);
}
