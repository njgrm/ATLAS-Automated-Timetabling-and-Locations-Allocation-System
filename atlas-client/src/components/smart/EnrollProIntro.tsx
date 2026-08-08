import { useEffect, useState, type ReactNode } from 'react';
import { School } from 'lucide-react';

import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';

/**
 * `EnrollProIntro` -- one-time-dismissible intro Popover (Decision 6).
 *
 * Renders its trigger child (the source-state chip). On first visit per browser
 * profile, opens a Popover explaining that ATLAS uses EnrollPro as roster
 * source. Dismiss persists a localStorage key so the intro never re-shows
 * unprompted.
 *
 * Re-trigger: delete `atlas.enrollpro-intro.dismissed` from localStorage or
 * expose a Help affordance in a future phase.
 */
const STORAGE_KEY = 'atlas.enrollpro-intro.dismissed';
export { STORAGE_KEY as ENROLLPRO_INTRO_STORAGE_KEY };

export type EnrollProIntroProps = {
	/** The element to anchor the intro to (typically the source-state chip). */
	children: ReactNode;
	/** Storage key override (used by tests). */
	storageKey?: string;
	/** Side for the popover. */
	side?: 'top' | 'bottom' | 'left' | 'right';
};

export function EnrollProIntro({ children, storageKey = STORAGE_KEY, side = 'bottom' }: EnrollProIntroProps) {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		try {
			if (!window.localStorage.getItem(storageKey)) {
				setOpen(true);
			}
		} catch {
			// localStorage may be unavailable (private mode); skip the intro rather
			// than blocking the page.
		}
	}, [storageKey]);

	function dismiss() {
		try {
			window.localStorage.setItem(storageKey, '1');
		} catch {
			// Ignore write failures; the in-session open state still closes.
		}
		setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent side={side} align="start" className="w-80 max-w-[90vw] rounded-xl p-4 text-sm leading-relaxed" data-testid="enrollpro-intro-popover">
				<div className="flex items-start gap-3">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
						<School className="size-4" />
					</div>
					<div className="min-w-0 space-y-1.5">
						<p className="font-semibold text-foreground">ATLAS uses EnrollPro as its roster source</p>
						<p className="text-xs text-muted-foreground">
							EnrollPro is the DepEd enrollment system. ATLAS reads the teacher and section roster from EnrollPro so you only need to maintain it in one place. When you see "Sync," it means ATLAS is refreshing from EnrollPro.
						</p>
						<div className="pt-1.5">
							<Button type="button" size="sm" onClick={dismiss} data-testid="enrollpro-intro-dismiss">
								Got it
							</Button>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}