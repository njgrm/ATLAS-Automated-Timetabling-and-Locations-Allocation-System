import { LoaderCircle } from 'lucide-react';

import type { TimetableLoadingIntent } from '@/components/timetable/timetable-route-loading-intent';

export function TimetableRouteLoadingState({ intent }: { intent: TimetableLoadingIntent }) {
	return (
		<section
			className="flex h-[calc(100svh-3.5rem)] min-h-0 flex-col items-center justify-center px-5 text-center"
			data-testid="timetable-route-loading-state"
			aria-live="polite"
		>
			<div className="w-full max-w-md rounded-xl border border-border bg-card px-6 py-7 shadow-sm">
				<p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Timetable workspace</p>
				<h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{intent.title}</h1>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{intent.message}</p>
				<div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary" role="status">
					<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
					<span>Loading this view…</span>
				</div>
			</div>
		</section>
	);
}
