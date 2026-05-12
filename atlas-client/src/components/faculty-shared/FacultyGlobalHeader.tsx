import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { Activity, Wifi, WifiOff, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import type { ReactNode } from 'react';

type SyncState = 'idle' | 'queued-offline' | 'syncing' | 'queued' | 'failed' | 'synced';

type Step = {
	id: number;
	label: string;
};

type FacultyGlobalHeaderProps = {
	title: string;
	subtitle?: string;
	steps?: Step[];
	activeStep?: number;
	online: boolean;
	syncState: SyncState;
	realtimeConnected?: boolean;
	advisory?: {
		title: string;
		variant?: 'info' | 'warning' | 'success' | 'destructive';
		message?: string;
	};
	onRetryFailed?: () => void;
	children?: ReactNode;
};

export default function FacultyGlobalHeader({
	title,
	subtitle,
	steps,
	activeStep,
	online,
	syncState,
	realtimeConnected,
	advisory,
	onRetryFailed,
	children,
}: FacultyGlobalHeaderProps) {
	const { scrollY } = useScroll();
	const [isScrolled, setIsScrolled] = useState(false);
	const [advisoryExpanded, setAdvisoryExpanded] = useState(false);

	// Shrink threshold
	useEffect(() => {
		return scrollY.on('change', (latest) => {
			setIsScrolled(latest > 60);
		});
	}, [scrollY]);

	const headerHeight = useTransform(scrollY, [0, 60], ['auto', '64px']);
	
	const syncColor = online ? 'text-emerald-600' : 'text-amber-600';
	const syncBg = online ? 'bg-emerald-50' : 'bg-amber-50';

	return (
		<motion.header
			style={{ height: isScrolled ? '64px' : 'auto' }}
			className="sticky top-0 z-30 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3 sm:px-6 transition-all duration-300"
		>
			<div className="max-w-7xl mx-auto flex flex-col gap-3">
				{/* Top Row: Title & Status Indicators */}
				<div className="flex items-center justify-between gap-4">
					<div className="min-w-0">
						<motion.h1 
							animate={{ fontSize: isScrolled ? '1.125rem' : '1.5rem' }}
							className="font-bold tracking-tight truncate"
						>
							{title}
						</motion.h1>
						<AnimatePresence>
							{!isScrolled && subtitle && (
								<motion.p 
									initial={{ opacity: 0, height: 0 }}
									animate={{ opacity: 1, height: 'auto' }}
									exit={{ opacity: 0, height: 0 }}
									className="text-xs text-muted-foreground truncate"
								>
									{subtitle}
								</motion.p>
							)}
						</AnimatePresence>
					</div>

					<div className="flex items-center gap-2 shrink-0">
						{/* Compact Status Indicator */}
						<div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${syncBg} ${syncColor}`}>
							{online ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
							<span className="hidden sm:inline">
								{syncState === 'syncing' ? 'Syncing...' : online ? 'Online' : 'Offline'}
							</span>
							{realtimeConnected && (
								<Activity className="size-3 text-emerald-500 animate-pulse" />
							)}
						</div>
						
						{syncState === 'failed' && onRetryFailed && (
							<Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={onRetryFailed}>
								Retry
							</Button>
						)}
					</div>
				</div>

				{/* Middle Row: Steps (Visible when not scrolled or on desktop) */}
				<AnimatePresence>
					{steps && (steps.length > 0) && (
						<motion.div 
							initial={false}
							animate={{ 
								height: isScrolled ? 0 : 'auto',
								opacity: isScrolled ? 0 : 1,
								marginBottom: isScrolled ? 0 : 4
							}}
							className="flex flex-wrap gap-1.5 overflow-hidden"
						>
							{steps.map((step) => (
								<span
									key={step.id}
									className={`rounded-full border px-3 py-0.5 text-[11px] font-bold transition-colors ${
										step.id === activeStep
											? 'border-primary bg-primary text-primary-foreground'
											: step.id < activeStep
												? 'border-primary/30 bg-primary/15 text-primary'
												: 'border-transparent bg-muted text-muted-foreground'
									}`}
								>
									{step.label}
								</span>
							))}
						</motion.div>
					)}
				</AnimatePresence>

				{/* Bottom Row: Smart Advisory */}
				<AnimatePresence>
					{!isScrolled && advisory && (
						<motion.div
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -10 }}
							className={`rounded-xl border p-3 ${
								advisory.variant === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' :
								advisory.variant === 'destructive' ? 'bg-red-50 border-red-200 text-red-900' :
								'bg-blue-50 border-blue-200 text-blue-900'
							}`}
						>
							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<AlertCircle className="size-4 shrink-0" />
									<p className="text-xs font-bold uppercase tracking-tight">{advisory.title}</p>
								</div>
								{advisory.message && (
									<button 
										onClick={() => setAdvisoryExpanded(!advisoryExpanded)}
										className="text-[10px] font-bold underline decoration-dotted"
									>
										{advisoryExpanded ? 'Hide' : 'Learn more'}
									</button>
								)}
							</div>
							{advisoryExpanded && advisory.message && (
								<motion.p 
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: 'auto', opacity: 1 }}
									className="mt-2 text-xs leading-relaxed border-t border-current/10 pt-2"
								>
									{advisory.message}
								</motion.p>
							)}
						</motion.div>
					)}
				</AnimatePresence>

				{children}
			</div>
		</motion.header>
	);
}
