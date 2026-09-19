import { ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
	buildIntegratedSystems,
	resolveDirectCompanionStartUrl,
	resolveEnrollProReverseStartUrl,
	shouldEnableEnrollPro,
	type IntegratedSystemItem,
} from '@/lib/integrated-systems';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';

export type IntegratedSystemsProps = {
	/** Authenticated privileged staff (same predicate as the shell's isAdmin). */
	privilegedStaff: boolean;
	/** Next start URL; injectable for hermetic tests. */
	enrollProStartUrl?: string | null;
	smartStartUrl?: string | null;
	aimsStartUrl?: string | null;
	className?: string;
};

function CompanionRow({ item, startUrl }: { item: IntegratedSystemItem; startUrl: string }) {
	return (
		<a
			data-testid={`integrated-system-${item.key.toLowerCase()}`}
			href={startUrl}
			className='flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
		>
			<ExternalLink className='size-4 shrink-0' />
			<span className='truncate'>{item.label}</span>
		</a>
	);
}

function DisabledRow({ item }: { item: IntegratedSystemItem }) {
	const reason = item.disabledReason ?? 'Unavailable';
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div
					data-testid={`integrated-system-${item.key.toLowerCase()}`}
					aria-disabled='true'
					className='flex h-8 w-full cursor-not-allowed items-center gap-2 rounded-md px-2 text-sm text-muted-foreground/70'
				>
					<span className='truncate'>{item.label}</span>
					{/* The reason must exist in the rendered/accessible DOM, not only in a
					    hover tooltip, so the disabled state is explicit rather than dead. */}
					<span className='sr-only'>{reason}</span>
				</div>
			</TooltipTrigger>
			<TooltipContent side='right' className='text-xs'>
				{reason}
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
			<span className='ml-auto shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
				Current system
			</span>
		</div>
	);
}

/**
 * Integrated Systems area (guide §4.5). Placed after primary navigation and
 * before system administration. Eligible companions navigate in the same tab
 * only when their explicit SSO start URL is configured. Missing configuration
 * fails closed as disabled text; MRF remains unavailable.
 */
export function IntegratedSystems({ privilegedStaff, enrollProStartUrl, smartStartUrl, aimsStartUrl, className }: IntegratedSystemsProps) {
	const systems = buildIntegratedSystems(privilegedStaff);
	const showEnrollPro = shouldEnableEnrollPro(privilegedStaff);
	// Fail closed: when the companion origin is not configured this is `null`
	// and EnrollPro renders as disabled plain text with no href.
	const startUrl = enrollProStartUrl === undefined ? resolveEnrollProReverseStartUrl() : enrollProStartUrl;
	const directUrls: Record<'AIMS' | 'SMART', string | null> = {
		AIMS: aimsStartUrl === undefined ? resolveDirectCompanionStartUrl('aims') : aimsStartUrl,
		SMART: smartStartUrl === undefined ? resolveDirectCompanionStartUrl('smart') : smartStartUrl,
	};
	const enrollProItem: IntegratedSystemItem = {
		key: 'ENROLLPRO',
		label: 'EnrollPro',
		enabled: Boolean(startUrl),
		disabledReason: 'EnrollPro is not configured',
	};

	return (
		<div data-testid='integrated-systems' className={cn('flex flex-col gap-0.5', className)}>
			{systems.map((item) => {
				if (item.current) return <CurrentRow key={item.key} item={item} />;
				if ((item.key === 'AIMS' || item.key === 'SMART') && privilegedStaff) {
					const directUrl = directUrls[item.key];
					return directUrl ? <CompanionRow key={item.key} item={item} startUrl={directUrl} /> : <DisabledRow key={item.key} item={item} />;
				}
				return <DisabledRow key={item.key} item={item} />;
			})}
			{showEnrollPro && (startUrl ? <CompanionRow item={enrollProItem} startUrl={startUrl} /> : <DisabledRow item={enrollProItem} />)}
		</div>
	);
}
