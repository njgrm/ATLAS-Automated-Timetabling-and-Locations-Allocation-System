import { Fragment, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/ui/breadcrumb';

export function AppBreadcrumbs({ breadcrumbs }: { breadcrumbs: string[] }) {
	return (
		<Breadcrumb>
			<BreadcrumbList className="gap-1 text-xs sm:gap-1.5">
				{breadcrumbs.map((label, index) => {
					const isCurrent = index === breadcrumbs.length - 1;
					return (
						<Fragment key={`${label}-${index}`}>
							{index > 0 ? <BreadcrumbSeparator /> : null}
							<BreadcrumbItem>
								{isCurrent ? (
									<BreadcrumbPage>{label}</BreadcrumbPage>
								) : (
									<span className="font-medium text-muted-foreground">{label}</span>
								)}
							</BreadcrumbItem>
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}

export function PageHeader({
	title,
	eyebrow,
	subtitle,
	source,
	nextAction,
	primaryAction,
	secondaryActions,
	className,
	testId,
}: {
	title: string;
	eyebrow?: string;
	subtitle?: string;
	source?: ReactNode;
	nextAction?: ReactNode;
	primaryAction?: ReactNode;
	secondaryActions?: ReactNode;
	className?: string;
	testId?: string;
}) {
	return (
		<header
			className={cn(
				'flex flex-col gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 text-card-foreground shadow-soft sm:px-4 lg:flex-row lg:items-center lg:justify-between',
				className,
			)}
			data-testid={testId ?? 'page-header'}
		>
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					{eyebrow ? <span className="text-xs font-bold uppercase tracking-wide text-primary">{eyebrow}</span> : null}
					{source}
				</div>
				<h1 className="mt-0.5 truncate text-2xl font-bold tracking-tight text-foreground">{title}</h1>
				{subtitle ? <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-muted-foreground lg:line-clamp-1">{subtitle}</p> : null}
			</div>
			{nextAction || primaryAction || secondaryActions ? (
				<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
					{nextAction ? <div className="min-w-0 sm:max-w-md">{nextAction}</div> : null}
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						{primaryAction ? <div data-page-primary-action>{primaryAction}</div> : null}
						{secondaryActions}
					</div>
				</div>
			) : null}
		</header>
	);
}
