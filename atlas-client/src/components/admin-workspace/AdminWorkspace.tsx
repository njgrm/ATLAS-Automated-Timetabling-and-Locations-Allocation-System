import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Search, SlidersHorizontal } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Input } from '@/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';

export type AdminSourceState = 'verified-live' | 'checking-source' | 'saved-data' | 'no-saved-data';

export type AdminSourceStateCopy = {
	label: string;
	description: string;
	nextAction: string;
};

type AdminStatItem = {
	label: string;
	value: ReactNode;
	helpText?: string;
	tone?: 'brand' | 'success' | 'warning' | 'info' | 'neutral';
};

const SOURCE_STATE_COPY: Record<AdminSourceState, AdminSourceStateCopy> = {
	'verified-live': {
		label: 'Verified live',
		description: 'This page was checked against the live source for the current school year.',
		nextAction: 'You can continue with the normal setup action.',
	},
	'checking-source': {
		label: 'Checking source',
		description: 'This page is usable while ATLAS verifies the live source in the background.',
		nextAction: 'Keep reviewing the list, then wait for the status to settle before final changes.',
	},
	'saved-data': {
		label: 'Using saved data',
		description: 'ATLAS is showing the last safe local copy because the live source is not fully verified.',
		nextAction: 'Review what is visible, then reconnect or sync before relying on final status.',
	},
	'no-saved-data': {
		label: 'No saved data',
		description: 'ATLAS does not have a safe local copy for this page yet.',
		nextAction: 'Reconnect or run a successful sync before this page can be used.',
	},
};

const sourceStateStyles: Record<AdminSourceState, string> = {
	'verified-live': 'border-emerald-200 bg-emerald-50 text-emerald-700',
	'checking-source': 'border-sky-200 bg-sky-50 text-sky-700',
	'saved-data': 'border-amber-200 bg-amber-50 text-amber-700',
	'no-saved-data': 'border-red-200 bg-red-50 text-red-700',
};

const statToneStyles: Record<NonNullable<AdminStatItem['tone']>, string> = {
	brand: 'border-primary/20 bg-primary/5 text-primary',
	success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
	warning: 'border-amber-200 bg-amber-50 text-amber-700',
	info: 'border-sky-200 bg-sky-50 text-sky-700',
	neutral: 'border-slate-200 bg-slate-50 text-slate-700',
};

export function AdminSourceStateChip({ state, copy }: { state: AdminSourceState; copy?: Partial<AdminSourceStateCopy> }) {
	const resolvedCopy = { ...SOURCE_STATE_COPY[state], ...copy };
	const StatusIcon = state === 'verified-live' ? CheckCircle2 : state === 'no-saved-data' ? AlertTriangle : Info;

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Badge
						variant="outline"
						className={cn(
							'h-8 cursor-help rounded-full border px-3 text-[0.68rem] font-bold uppercase tracking-wide shadow-none',
							sourceStateStyles[state],
							state === 'checking-source' && 'animate-pulse',
						)}
					>
						<StatusIcon className="mr-1.5 size-3.5" />
						{resolvedCopy.label}
					</Badge>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="max-w-72 space-y-1 p-3 text-xs leading-relaxed">
					<p className="font-bold text-popover-foreground">{resolvedCopy.description}</p>
					<p className="text-muted-foreground">{resolvedCopy.nextAction}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function AdminStatBanner({ items }: { items: AdminStatItem[] }) {
	if (items.length === 0) return null;

	return (
		<div className="flex flex-wrap items-center gap-2">
			{items.map((item) => (
				<div
					key={item.label}
					className={cn(
						'flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold shadow-sm',
						statToneStyles[item.tone ?? 'neutral'],
					)}
				>
					<span className="text-[0.65rem] uppercase tracking-wide opacity-75">{item.label}</span>
					<span className="text-sm font-bold tabular-nums">{item.value}</span>
					{item.helpText && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button type="button" variant="ghost" size="icon" className="size-5 rounded-full" aria-label={`${item.label} help`}>
										<Info className="size-3.5 opacity-70" />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="bottom" className="max-w-64 text-xs leading-relaxed">
									{item.helpText}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
				</div>
			))}
		</div>
	);
}

export function AdminWorkspaceFrame({
	title,
	description,
	sourceState,
	sourceCopy,
	stats,
	primaryActions,
	secondaryActions,
	toolbar,
	children,
}: {
	title: string;
	description: string;
	sourceState: AdminSourceState;
	sourceCopy?: Partial<AdminSourceStateCopy>;
	stats?: AdminStatItem[];
	primaryActions?: ReactNode;
	secondaryActions?: ReactNode;
	toolbar?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">
			<div className="shrink-0 border-b bg-background/80 px-6 py-4 backdrop-blur-md">
				<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
					<div className="min-w-0 space-y-3">
						<div className="space-y-1">
							<h1 className="text-2xl font-bold text-slate-900 lg:text-3xl">{title}</h1>
							<p className="max-w-3xl text-sm font-medium leading-6 text-slate-500">{description}</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<AdminSourceStateChip state={sourceState} copy={sourceCopy} />
							<AdminStatBanner items={stats ?? []} />
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2 xl:justify-end">
						{secondaryActions}
						{primaryActions}
					</div>
				</div>
				{toolbar && <div className="mt-4 rounded-2xl border border-slate-100 bg-white/75 p-3 shadow-sm">{toolbar}</div>}
			</div>
			{children}
		</div>
	);
}

export function AdminSearchFilterToolbar({
	searchValue,
	onSearchChange,
	searchPlaceholder,
	filtersOpen,
	onToggleFilters,
	hasActiveFilters,
	children,
}: {
	searchValue: string;
	onSearchChange: (value: string) => void;
	searchPlaceholder: string;
	filtersOpen: boolean;
	onToggleFilters: () => void;
	hasActiveFilters: boolean;
	children?: ReactNode;
}) {
	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
					<div className="relative w-full sm:max-w-sm">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder={searchPlaceholder}
							value={searchValue}
							onChange={(event) => onSearchChange(event.target.value)}
							className="h-9 pl-9"
						/>
					</div>
					<Button variant={filtersOpen ? 'secondary' : 'outline'} size="sm" className="h-9 gap-2" onClick={onToggleFilters}>
						<SlidersHorizontal className="size-4" />
						Filters
						{hasActiveFilters && <Badge className="ml-1 bg-primary text-primary-foreground">Active</Badge>}
					</Button>
				</div>
			</div>
			{filtersOpen && <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">{children}</div>}
		</div>
	);
}

export function AdminTableShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
	return (
		<div className="flex-1 min-h-0 px-6 py-4">
			<Card className="flex h-full flex-col overflow-hidden border-0 bg-white shadow-soft">
				<div className="flex-1 min-h-0 overflow-auto">{children}</div>
				{footer && <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-4 py-3">{footer}</div>}
			</Card>
		</div>
	);
}

export function AdminStatePanel({
	icon,
	title,
	description,
	action,
}: {
	icon: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		<div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center text-muted-foreground">
			<div className="rounded-2xl bg-primary/5 p-4 text-primary">{icon}</div>
			<div className="space-y-1">
				<p className="font-bold text-foreground">{title}</p>
				{description && <p className="text-xs leading-5">{description}</p>}
			</div>
			{action}
		</div>
	);
}