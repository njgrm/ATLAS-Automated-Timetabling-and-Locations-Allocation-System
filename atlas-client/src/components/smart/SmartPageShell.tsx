import type { ReactNode } from 'react';
import {
	AlertCircle,
	ArrowRight,
	CheckCircle2,
	HelpCircle,
	Info,
	Loader2,
	MoreHorizontal,
	RefreshCw,
	ServerOff,
	Sparkles,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';

export type SmartSourceTone = 'live' | 'saved' | 'checking' | 'warning' | 'unavailable' | 'neutral';

const sourceToneClass: Record<SmartSourceTone, string> = {
	live: 'border-emerald-200 bg-emerald-50 text-emerald-700',
	saved: 'border-sky-200 bg-sky-50 text-sky-700',
	checking: 'border-primary/20 bg-primary/5 text-primary',
	warning: 'border-amber-200 bg-amber-50 text-amber-800',
	unavailable: 'border-destructive/20 bg-destructive/10 text-destructive',
	neutral: 'border-border bg-muted text-muted-foreground',
};

export function SmartPageFrame({
	children,
	className,
	contentClassName,
	testId,
}: {
	children: ReactNode;
	className?: string;
	contentClassName?: string;
	testId?: string;
}) {
	return (
		<div className={cn('flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-primary/5', className)} data-testid={testId}>
			<div className={cn('flex-1 min-h-0 overflow-auto px-3 py-3 sm:px-5 lg:px-6', contentClassName)}>
				{children}
			</div>
		</div>
	);
}

export function SmartSourceStatusChip({
	label,
	tone = 'neutral',
	detail,
	testId,
}: {
	label: string;
	tone?: SmartSourceTone;
	detail?: string;
	testId?: string;
}) {
	return (
		<Badge
			variant="outline"
			className={cn('min-h-8 rounded-full px-3 py-1 text-xs font-bold shadow-sm', sourceToneClass[tone])}
			data-testid={testId}
			title={undefined}
		>
			<span className="inline-flex min-w-0 items-center gap-1.5">
				{tone === 'checking' ? <Loader2 className="size-3.5 animate-spin" /> : tone === 'unavailable' ? <ServerOff className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
				<span className="truncate">{label}</span>
				{detail ? <span className="hidden font-semibold opacity-75 sm:inline">· {detail}</span> : null}
			</span>
		</Badge>
	);
}

export function SmartCommandBar({
	title,
	eyebrow,
	subtitle,
	source,
	nextAction,
	primaryAction,
	help,
	moreGroups,
	className,
	testId,
}: {
	title: string;
	eyebrow?: string;
	subtitle?: string;
	source?: ReactNode;
	nextAction?: ReactNode;
	primaryAction?: ReactNode;
	help?: { title: string; description: string; steps: SmartHelpStep[] };
	moreGroups?: SmartMoreGroup[];
	className?: string;
	testId?: string;
}) {
	return (
		<header
			className={cn(
				'rounded-2xl border border-primary/10 bg-white px-3 py-2.5 shadow-soft sm:px-4',
				'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between',
				className,
			)}
			data-testid={testId ?? 'smart-command-bar'}
		>
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					{eyebrow ? <span className="text-[0.65rem] font-bold uppercase tracking-wide text-primary">{eyebrow}</span> : null}
					{source}
				</div>
				<h1 className="mt-0.5 truncate text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
				{subtitle ? <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-slate-500 lg:line-clamp-1">{subtitle}</p> : null}
			</div>
			<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
				{nextAction ? <div className="min-w-0 sm:max-w-md">{nextAction}</div> : null}
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					{primaryAction}
					{help ? <SmartHelpTrigger {...help} /> : null}
					{moreGroups?.length ? <SmartMoreMenu groups={moreGroups} /> : null}
				</div>
			</div>
		</header>
	);
}

export function SmartNextStepCard({
	label = 'Next step',
	title,
	body,
	tone = 'neutral',
	icon,
	action,
	testId,
}: {
	label?: string;
	title: string;
	body?: string;
	tone?: SmartSourceTone;
	icon?: ReactNode;
	action?: ReactNode;
	testId?: string;
}) {
	return (
		<div
			className={cn(
				'flex min-w-0 items-start gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm',
				sourceToneClass[tone],
			)}
			data-testid={testId ?? 'smart-next-step-card'}
		>
			<div className="mt-0.5 shrink-0">{icon ?? <Sparkles className="size-4" />}</div>
			<div className="min-w-0 flex-1">
				<p className="text-[0.65rem] font-bold uppercase tracking-wide opacity-75">{label}</p>
				<p className="font-bold leading-tight">{title}</p>
				{body ? <p className="mt-0.5 line-clamp-2 text-xs font-medium opacity-80">{body}</p> : null}
			</div>
			{action ? <div className="shrink-0">{action}</div> : null}
		</div>
	);
}

export type SmartHelpStep = {
	title: string;
	body: string;
	target?: string;
	icon?: ReactNode;
};

export function SmartHelpTrigger({
	title,
	description,
	steps,
	triggerLabel = 'Help',
	className,
}: {
	title: string;
	description: string;
	steps: SmartHelpStep[];
	triggerLabel?: string;
	className?: string;
}) {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button type="button" variant="outline" size="sm" className={cn('h-10 rounded-xl px-3', className)} data-testid="smart-help-trigger">
					<HelpCircle className="mr-1.5 size-4" />
					{triggerLabel}
				</Button>
			</DialogTrigger>
			<DialogContent className="rounded-2xl sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-3 sm:grid-cols-2" data-testid="smart-help-steps">
					{steps.map((step, index) => (
						<div key={`${step.title}-${index}`} className="rounded-2xl border border-primary/10 bg-primary/5 p-3">
							<div className="flex items-start gap-3">
								<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
									{step.icon ?? <Info className="size-4" />}
								</div>
								<div className="min-w-0">
									<p className="text-xs font-bold uppercase text-primary">Step {index + 1}</p>
									<p className="font-bold text-slate-900">{step.title}</p>
									<p className="mt-1 text-sm leading-relaxed text-slate-600">{step.body}</p>
									{step.target ? <Badge variant="outline" className="mt-2 rounded-full bg-white text-xs">{step.target}</Badge> : null}
								</div>
							</div>
						</div>
					))}
				</div>
				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" data-testid="smart-help-finish">Got it</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export type SmartMoreGroup = {
	label: string;
	items: Array<{
		label: string;
		onSelect?: () => void;
		href?: string;
		disabled?: boolean;
		description?: string;
	}>;
};

export function SmartMoreMenu({ groups }: { groups: SmartMoreGroup[] }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="outline" size="sm" className="h-10 rounded-xl px-3" data-testid="smart-more-menu-trigger">
					<MoreHorizontal className="mr-1.5 size-4" />
					More
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-72 rounded-xl">
				{groups.map((group, groupIndex) => (
					<DropdownMenuGroup key={group.label} data-testid={`smart-more-group-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
						{groupIndex > 0 ? <DropdownMenuSeparator /> : null}
						<DropdownMenuLabel className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{group.label}</DropdownMenuLabel>
						{group.items.map((item) => (
							<DropdownMenuItem
								key={item.label}
								disabled={item.disabled}
								onSelect={(event) => {
									if (item.href) {
										event.preventDefault();
										window.location.assign(item.href);
										return;
									}
									item.onSelect?.();
								}}
								className="min-h-11 items-start gap-2 py-2"
							>
								<ArrowRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
								<span className="min-w-0">
									<span className="block font-semibold">{item.label}</span>
									{item.description ? <span className="block text-xs font-normal leading-snug text-muted-foreground">{item.description}</span> : null}
								</span>
							</DropdownMenuItem>
						))}
					</DropdownMenuGroup>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function SmartEmptyState({
	title,
	body,
	action,
	icon,
	testId,
}: {
	title: string;
	body: string;
	action?: ReactNode;
	icon?: ReactNode;
	testId?: string;
}) {
	return (
		<Card className="rounded-2xl border-dashed border-primary/20 bg-white shadow-soft" data-testid={testId ?? 'smart-empty-state'}>
			<CardContent className="flex flex-col items-center px-4 py-10 text-center">
				<div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
					{icon ?? <Info className="size-6" />}
				</div>
				<p className="text-base font-bold text-slate-900">{title}</p>
				<p className="mt-1 max-w-lg text-sm leading-relaxed text-slate-500">{body}</p>
				{action ? <div className="mt-4">{action}</div> : null}
			</CardContent>
		</Card>
	);
}

export function SmartErrorState({
	title,
	body,
	action,
	testId,
}: {
	title: string;
	body: string;
	action?: ReactNode;
	testId?: string;
}) {
	return (
		<Card className="rounded-2xl border-destructive/20 bg-destructive/5 shadow-soft" data-testid={testId ?? 'smart-error-state'}>
			<CardContent className="flex items-start gap-3 px-4 py-6">
				<AlertCircle className="mt-1 size-5 shrink-0 text-destructive" />
				<div className="min-w-0 flex-1">
					<p className="font-bold text-destructive">{title}</p>
					<p className="mt-1 text-sm leading-relaxed text-destructive/80">{body}</p>
					{action ? <div className="mt-4">{action}</div> : null}
				</div>
			</CardContent>
		</Card>
	);
}

export function SmartLoadingState({ label = 'Loading page details…' }: { label?: string }) {
	return (
		<div className="flex items-center gap-2 rounded-2xl border border-primary/10 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-soft" data-testid="smart-loading-state">
			<RefreshCw className="size-4 animate-spin text-primary" />
			{label}
		</div>
	);
}
