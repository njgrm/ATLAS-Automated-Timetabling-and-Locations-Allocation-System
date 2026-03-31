import { CalendarClock, Construction, Lock } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/ui/card';

const PAGE_INFO: Record<string, { icon: typeof Construction; title: string; description: string; note?: string }> = {
	timetable: {
		icon: CalendarClock,
		title: 'Timetable Generation',
		description: 'Schedule generation, review, and publishing will be available once Setup phase is complete.',
		note: 'Complete all Setup checklist items (subjects, faculty, assignments, sections, and buildings) before this feature unlocks.',
	},
	analytics: {
		icon: Construction,
		title: 'Analytics',
		description: 'Schedule analytics and utilization insights are planned for a future release.',
	},
};

export default function ComingSoon() {
	const { pathname } = useLocation();
	const pageName = pathname.split('/').filter(Boolean).pop() ?? 'page';
	const info = PAGE_INFO[pageName];
	const Icon = info?.icon ?? Construction;
	const title = info?.title ?? pageName.charAt(0).toUpperCase() + pageName.slice(1);
	const description = info?.description ?? 'This feature is coming soon.';

	return (
		<div className="h-[calc(100svh-3.5rem)] flex items-center justify-center px-6 py-4">
			<Card className="max-w-md shadow-sm border-border">
				<CardContent className="pt-6 text-center">
					<div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
						<Icon className="size-7 text-muted-foreground/50" />
					</div>
					<h1 className="mt-4 text-lg font-bold text-foreground">{title}</h1>
					<p className="mt-2 text-sm text-muted-foreground leading-relaxed">
						{description}
					</p>
					{info?.note && (
						<div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-left">
							<Lock className="size-3.5 mt-0.5 shrink-0 text-amber-600" />
							<p className="text-xs text-amber-700">{info.note}</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
