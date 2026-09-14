import { ExternalLink } from 'lucide-react';

import { getBackHref } from '@/lib/bridge';

export type BackToEnrollProLinkProps = {
	/**
	 * Resolved reciprocal link. Defaults to the fail-closed client resolution so
	 * production consumers cannot accidentally pass a stale or raw-IP URL.
	 */
	href?: string | null;
	className?: string;
};

/**
 * The single "Back to EnrollPro" anchor shared by the desktop sidebar and the
 * mobile navigation drawer. It fails closed: when no EnrollPro origin is
 * configured (`getBackHref()` returns `null`) it renders nothing at all.
 */
export function BackToEnrollProLink({ href = getBackHref(), className }: BackToEnrollProLinkProps) {
	if (!href) return null;
	return (
		<a
			data-testid='back-to-enrollpro'
			href={href}
			className={className ?? 'flex items-center gap-2 text-xs text-muted-foreground'}
		>
			<ExternalLink className='size-3.5 shrink-0' />
			<span>Back to EnrollPro</span>
		</a>
	);
}
