import { NavLink } from 'react-router-dom';
import { Home } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

/**
 * D6 — the ATLAS teacher portal is retired. Teacher self-service is handled in
 * SMART, and per the operator instruction of 2026-09-26 `/my` is retired too, so
 * this bar's single Home destination is the retirement tombstone rather than a
 * dashboard. It stays so faculty keep one reachable faculty destination; the
 * removed teacher-portal tabs (schedule, support preferences, room requests) are
 * gone.
 */
const FACULTY_TABS = [
	{ to: '/my', label: 'Home', icon: Home, end: true },
] as const;

export function FacultyMobileBottomNav() {
	const reduceMotion = useReducedMotion();
	return (
		<nav
			aria-label='Faculty primary navigation'
			className='lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-card/95 backdrop-blur-md shadow-[0_-1px_0_rgba(0,0,0,0.04)]'
			style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
		>
			<ul className='mx-auto grid max-w-md grid-cols-1'>
				{FACULTY_TABS.map((tab) => (
					<li key={tab.to}>
						<NavLink
							to={tab.to}
							end={tab.end}
							className={({ isActive }) =>
								[
									'relative flex flex-col items-center justify-center gap-1 px-1 pt-2.5 pb-1.5 text-xs font-medium transition-colors',
									isActive ? 'text-primary' : 'text-muted-foreground active:text-foreground',
								].join(' ')
							}
						>
							{({ isActive }) => (
								<>
									<span
										className={[
											'relative flex h-9 w-12 items-center justify-center rounded-full transition-colors',
											isActive ? 'bg-primary/10' : 'bg-transparent',
										].join(' ')}
									>
										<tab.icon className='size-[22px]' strokeWidth={isActive ? 2.4 : 2} aria-hidden='true' />
										{isActive && (
											<motion.span
												layoutId={reduceMotion ? undefined : 'faculty-tab-active'}
												className='absolute inset-0 rounded-full ring-1 ring-primary/20'
												transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32 }}
											/>
										)}
									</span>
									<span className={`leading-none ${isActive ? 'font-semibold' : ''}`}>{tab.label}</span>
								</>
							)}
						</NavLink>
					</li>
				))}
			</ul>
		</nav>
	);
}

export default FacultyMobileBottomNav;
