import { ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
	buildIntegratedSystems,
	resolveEnrollProReverseStartUrl,
	shouldEnableEnrollPro,
	type IntegratedSystemItem,
} from '@/lib/integrated-systems';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';

export type IntegratedSystemsProps = {
	/** Authenticated privileged staff (same predicate as the shell's isAdmin). */
	privilegedStaff: boolean;
	/** Next start URL; injectable for hermetic tests. */
	enrollProStartUrl?: string;
	className?: string;
};

function EnrollProRow({ startUrl }: { startUrl: string }) {
	return (
		<a
			data-testid='integrated-system-enrollpro'
			href={startUrl}
			className='flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
		>
			<ExternalLink className='size-4 shrink-0' />
			<span className='truncate'>EnrollPro</span>
		</a>
	);
}

function DisabledRow({ item }: { item: IntegratedSystemItem }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div
					data-testid={`integrated-system-${item.key.toLowerCase()}`}
					aria-disabled='true'
					className='flex h-8 w-full cursor-not-allowed items-center gap-2 rounded-md px-2 text-sm text-muted-foreground/70'
				>
					<span className='truncate'>{item.label}</span>
				</div>
			</TooltipTrigger>
			<TooltipContent side='right' className='text-[0.65rem]'>
				{item.disabledReason ?? 'Unavailable'}
			</TooltipContent>
		</Tooltip>
	);
}

function CurrentRow({ item }: { item: IntegratedSystemItem }) {
	return (
		<div
			data-testid={`integrated-system-${item.key.toLowerCase()}`}
			aria-current='true'
			className='flex h-8 w-full items-center gap-2 rounded-md bg-sidebar-accent/60 px-2 text-sm font-semibold text-sidebar-accent-foreground'
		>
			<span className='truncate'>{item.label}</span>
			<span className='ml-auto shrink-0 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground'>
				Current system
			</span>
		</div>
	);
}

/**
 * Integrated Systems area (guide §4.5). Placed after primary navigation and
 * before system administration. EnrollPro is the only enabled companion: it
 * navigates same-tab to EnrollPro's reverse-SSO start endpoint. AIMS/SMART/MRF
 * are plain disabled text with no raw companion URL anywhere.
 */
export function IntegratedSystems({ privilegedStaff, enrollProStartUrl, className }: IntegratedSystemsProps) {
	const systems = buildIntegratedSystems(privilegedStaff);
	const showEnrollPro = shouldEnableEnrollPro(privilegedStaff);
	const startUrl = enrollProStartUrl ?? resolveEnrollProReverseStartUrl();

	return (
		<div data-testid='integrated-systems' className={cn('flex flex-col gap-0.5', className)}>
			{systems.map((item) => {
				if (item.current) return <CurrentRow key={item.key} item={item} />;
				return <DisabledRow key={item.key} item={item} />;
			})}
			{showEnrollPro && <EnrollProRow startUrl={startUrl} />}
		</div>
	);
}
