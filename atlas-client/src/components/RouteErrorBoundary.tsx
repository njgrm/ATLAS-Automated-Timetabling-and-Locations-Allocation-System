import { AlertTriangle, RefreshCw, Undo2 } from 'lucide-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

import { Button } from '@/ui/button';

/**
 * CLIENT-QUALITY-C01 — route-level error boundary.
 *
 * Wired through React Router's `errorElement` so a component failure inside a
 * route subtree degrades to this recoverable surface instead of unmounting the
 * whole application and leaving the framework crash screen. Before this, the
 * `/timetable` React #310 hook-order crash had no boundary at all.
 *
 * The fallback is intentionally non-mutating: reload and return-to-dashboard.
 */
export function RouteErrorBoundary() {
	const error = useRouteError();

	let heading = 'Something went wrong';
	let detail = 'The page could not be displayed. Reload to try again.';

	if (isRouteErrorResponse(error)) {
		heading = `${error.status} ${error.statusText}`;
		detail = typeof error.data === 'string' && error.data.length > 0
			? error.data
			: 'The requested route could not be loaded.';
	} else if (error instanceof Error) {
		heading = 'This page hit an unexpected error';
		detail = error.message;
	}

	return (
		<div
			role="alert"
			data-testid="route-error-boundary"
			className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center"
		>
			<div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
				<AlertTriangle className="size-6" aria-hidden="true" />
			</div>
			<div className="space-y-1">
				<h1 className="text-lg font-bold tracking-tight text-foreground">{heading}</h1>
				<p className="max-w-md text-sm font-medium text-muted-foreground">{detail}</p>
			</div>
			<div className="flex flex-wrap items-center justify-center gap-2">
				<Button type="button" onClick={() => window.location.reload()} className="gap-1.5">
					<RefreshCw className="size-4" aria-hidden="true" />
					Reload page
				</Button>
				<Button asChild variant="outline" className="gap-1.5">
					<Link to="/">
						<Undo2 className="size-4" aria-hidden="true" />
						Return to dashboard
					</Link>
				</Button>
			</div>
		</div>
	);
}

export default RouteErrorBoundary;
