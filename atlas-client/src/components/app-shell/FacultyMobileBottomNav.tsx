import { NavLink } from 'react-router-dom';
import { CalendarClock, ClipboardList, Home, MapPin } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

const FACULTY_TABS = [
	{ to: '/my', label: 'Home', icon: Home, end: true },
	{ to: '/my/schedule', label: 'Schedule', icon: CalendarClock, end: false },
	{ to: '/my/preferences', label: 'Support', icon: ClipboardList, end: false },
	{ to: '/my/room-preferences', label: 'Requests', icon: MapPin, end: false },
] as const;

export function FacultyMobileBottomNav() {
	const reduceMotion = useReducedMotion();
	return (
		<nav
			aria-label='Faculty primary navigation'
			className='lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-card/95 backdrop-blur-md shadow-[0_-1px_0_rgba(0,0,0,0.04)]'
			style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
		>
			<ul className='mx-auto grid max-w-md grid-cols-4'>
				{FACULTY_TABS.map((tab) => (
					<li key={tab.to}>
						<NavLink
							to={tab.to}
							end={tab.end}
							className={({ isActive }) =>
								[
									'relative flex flex-col items-center justify-center gap-1 px-1 pt-2.5 pb-1.5 text-[11px] font-medium transition-colors',
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
