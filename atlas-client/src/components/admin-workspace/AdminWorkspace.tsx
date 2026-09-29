import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, MoreHorizontal } from 'lucide-react';

import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';
import { SmartHelpTrigger } from '@/components/smart/SmartPageShell';
import { CompactTitleStrip } from '@/components/app-shell/CompactTitleStrip';

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

function resolveSourceStateCopy(state: AdminSourceState, copy?: Partial<AdminSourceStateCopy>): AdminSourceStateCopy {
	return { ...SOURCE_STATE_COPY[state], ...copy };
}

export function AdminSourceStateChip({ state, copy, lastVerified }: { state: AdminSourceState; copy?: Partial<AdminSourceStateCopy>; lastVerified?: string }) {
	const resolvedCopy = resolveSourceStateCopy(state, copy);
	const StatusIcon = state === 'verified-live' ? CheckCircle2 : state === 'no-saved-data' ? AlertTriangle : Info;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					data-source-state={state}
					className={cn(
						'relative z-20 h-8 rounded-full border px-2.5 text-[0.65rem] font-bold uppercase tracking-wide shadow-none',
						sourceStateStyles[state],
						state === 'checking-source' && 'animate-pulse',
					)}
					aria-label={`${resolvedCopy.label}. Open source details.`}
				>
					<StatusIcon className="mr-1.5 size-3.5" />
					{resolvedCopy.label}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80 space-y-2 rounded-xl p-3 text-sm" data-testid="setup-source-details-popover">
				<p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Source details</p>
				<p className="font-bold text-popover-foreground">{resolvedCopy.description}</p>
				<p className="text-sm leading-snug text-muted-foreground">{resolvedCopy.nextAction}</p>
				<div className="rounded-lg border border-primary/10 bg-primary/5 p-2 text-xs leading-5 text-muted-foreground">
					<p className="font-semibold text-foreground">EnrollPro roster source</p>
					<p>EnrollPro is the DepEd enrollment system. ATLAS reads teachers and sections from EnrollPro, then keeps scheduling work inside ATLAS.</p>
				</div>
				<p className="border-t border-slate-100 pt-2 text-xs font-semibold text-muted-foreground" data-testid="setup-source-last-verified">
					Last verified: {lastVerified ?? 'Not verified in this session'}
				</p>
			</PopoverContent>
		</Popover>
	);
}

export function AdminStatBanner({ items }: { items: AdminStatItem[] }) {
	if (items.length === 0) return null;

	return (
		<div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5" data-testid="setup-readiness-strip">
			{items.map((item) => (
				<div
					key={item.label}
					className={cn(
						'flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold shadow-sm',
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
	lastVerified,
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
	lastVerified?: string;
	stats?: AdminStatItem[];
	primaryActions?: ReactNode;
	secondaryActions?: ReactNode;
	toolbar?: ReactNode;
	children: ReactNode;
}) {
	const resolvedSourceCopy = resolveSourceStateCopy(sourceState, sourceCopy);

	return (
		<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">
			{/* A3-TITLE-STRIP-C3: the strip shell is owned by the shared contract;
				the h1, the source chip, and the action row stay here, at this call
				site. A's title scale (text-lg / lg:text-xl) is deliberately NOT
				normalized against strip B's — see the suite header's OPEN DECISION. */}
			<CompactTitleStrip
				stripTestId="admin-command-header"
				rowTestId="setup-compact-command-header"
				title={<h1 className="shrink-0 text-lg font-bold text-foreground lg:text-xl">{title}</h1>}
				statusDescription={resolvedSourceCopy.description}
				statusNextAction={resolvedSourceCopy.nextAction}
				status={
					<>
						<AdminSourceStateChip state={sourceState} copy={sourceCopy} lastVerified={lastVerified} />
						<p className="sr-only" aria-live="polite" data-testid="admin-source-truth-summary">
							{resolvedSourceCopy.label}. {resolvedSourceCopy.description} {resolvedSourceCopy.nextAction}
						</p>
					</>
				}
				actions={
					<>
						{primaryActions}
							{/* A5 c8 (2026-09-29) — THE `Narrow long lists` STEP IS GONE, and this
							    comment is where its reasoning is kept.

							    It read: *"Use the filter controls in the toolbar above the list. On
							    pages where the toolbar has a `More filters` button, the narrower
							    lookups sit behind it."* Every one of those buttons is deleted —
							    `AdminSearchFilterToolbar` itself is gone from this file, and every
							    list page now renders `@/ui/filter-bar`'s one wrapping row — so
							    the step instructed a scheduler to hunt for a control that no
							    longer exists anywhere in the product. A help step that points at
							    nothing is worse than no help step, and the surviving three steps
							    are the ones a first-time visitor actually performs. */}
							<SmartHelpTrigger
								title={`How to use ${title}`}
								description={description}
								steps={[
									{ title: 'Check source status', body: 'Confirm whether ATLAS is using live source data or a saved setup copy.', target: 'Source chip' },
									{ title: 'Review the first issue', body: 'Use the visible list or table to find the first row needing attention.', target: 'Setup list' },
									{ title: 'Use one action first', body: 'Press the primary row action before opening advanced details.', target: 'Primary action' },
								]}
							/>
						{secondaryActions ? (
							<Popover>
								<PopoverTrigger asChild>
									<Button type="button" variant="outline" size="sm" className="h-9 gap-2 rounded-xl" aria-label={`${title} more actions`}>
										<MoreHorizontal className="size-4" />
										<span className="hidden sm:inline">More</span>
									</Button>
								</PopoverTrigger>
								<PopoverContent align="end" className="w-72 rounded-xl p-3">
									<div className="space-y-2">
										<p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground" data-testid="setup-more-daily">{title} actions</p>
										<div className="flex flex-col gap-2 [&_button]:w-full [&_button]:justify-start">
											{secondaryActions}
										</div>
									</div>
								</PopoverContent>
							</Popover>
						) : null}
					</>
				}
			/>
			{(stats?.length || toolbar) ? (
				<div className="shrink-0 space-y-1 border-b border-slate-100 bg-slate-50/70 px-4 py-1.5 lg:px-5">
					{stats?.length ? <AdminStatBanner items={stats} /> : null}
					{toolbar ? <div className="rounded-xl border border-slate-100 bg-white/75 p-1 shadow-sm">{toolbar}</div> : null}
				</div>
			) : null}
			{children}
		</div>
	);
}

export function AdminTableShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
	return (
		<div className="flex-1 min-h-0 px-4 py-3 lg:px-5 [@media(max-height:500px)]:py-2" data-testid="admin-content-shell">
			<Card className="flex h-full flex-col overflow-hidden border-0 bg-white shadow-soft">
				<div className="flex-1 min-h-0 overflow-auto">{children}</div>
				{footer && <div className="relative z-20 shrink-0 border-t border-slate-100 bg-slate-50 px-3 py-2 shadow-[0_-8px_16px_rgba(15,23,42,0.06)]">{footer}</div>}
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
