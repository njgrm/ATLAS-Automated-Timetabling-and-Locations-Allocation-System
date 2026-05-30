import { ExternalLink, LogOut } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

import { getBackHref } from '@/lib/bridge';
import { Button } from '@/ui/button';
import { Separator } from '@/ui/separator';

import type { NavItemDef } from './navigation';

export type MobileNavigationDrawerProps = {
	open: boolean;
	onClose: () => void;
	items: NavItemDef[];
	currentPathname: string;
	onLogout: () => void;
};

export function MobileNavigationDrawer({
	open,
	onClose,
	items,
	currentPathname,
	onLogout,
}: MobileNavigationDrawerProps) {
	const navigate = useNavigate();

	return (
		<AnimatePresence initial={false}>
			{open && (
				<>
					<motion.button
						type='button'
						aria-label='Close navigation menu'
						className='fixed inset-0 top-14 z-40 bg-black/30 will-change-[opacity]'
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.16, ease: 'easeOut' }}
						onClick={onClose}
					/>
					<motion.nav
						className='fixed inset-x-2 top-14 z-50 overflow-hidden rounded-b-2xl border border-border bg-background shadow-xl transform-gpu will-change-transform'
						initial={{ opacity: 0, y: -16 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -16 }}
						transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
					>
						<div className='space-y-1 p-3'>
							{items.map((item) => (
								<Button
									key={item.to}
									variant={currentPathname === item.to ? 'secondary' : 'ghost'}
									className='h-11 w-full justify-start text-sm'
									onClick={() => {
										navigate(item.to);
										onClose();
									}}
								>
									<item.icon className='mr-2 size-4' />
									{item.label}
								</Button>
							))}
							<Separator className='my-2' />
							<Button asChild variant='ghost' className='h-11 w-full justify-start text-sm text-muted-foreground'>
								<a href={getBackHref()}>
									<ExternalLink className='mr-2 size-4' />
									Back to EnrollPro
								</a>
							</Button>
							<Button variant='ghost' className='h-11 w-full justify-start text-sm text-destructive' onClick={onLogout}>
								<LogOut className='mr-2 size-4' />
								Sign out
							</Button>
						</div>
					</motion.nav>
				</>
			)}
		</AnimatePresence>
	);
}
