import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, GraduationCap, X } from 'lucide-react';

import { Button } from '@/ui/button';

export interface TutorialStep {
	/** CSS selector for the target element to spotlight */
	target: string;
	title: string;
	content: string;
	/** Only show this step for these roles. Omit = all roles. */
	roles?: string[];
}

interface TutorialOverlayProps {
	steps: TutorialStep[];
	/** Current user role — used to filter role-specific steps */
	userRole?: string;
	/** Called when the tutorial finishes or is skipped */
	onComplete: () => void;
	/** Whether the tutorial is currently active */
	active: boolean;
}

function getTargetRect(selector: string): DOMRect | null {
	const el = document.querySelector(selector);
	if (!el) return null;
	return el.getBoundingClientRect();
}

export function TutorialOverlay({ steps, userRole, onComplete, active }: TutorialOverlayProps) {
	const [currentIndex, setCurrentIndex] = useState(0);

	const filteredSteps = useMemo(
		() => steps.filter((s) => !s.roles || !userRole || s.roles.includes(userRole)),
		[steps, userRole],
	);

	// Reset index when activated
	useEffect(() => {
		if (active) setCurrentIndex(0);
	}, [active]);

	const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

	// Track target element position
	useEffect(() => {
		if (!active || filteredSteps.length === 0) return;
		const step = filteredSteps[currentIndex];
		if (!step) return;

		const update = () => setTargetRect(getTargetRect(step.target));
		update();

		// Re-measure on scroll/resize
		const iv = setInterval(update, 300);
		window.addEventListener('resize', update);
		window.addEventListener('scroll', update, true);
		return () => {
			clearInterval(iv);
			window.removeEventListener('resize', update);
			window.removeEventListener('scroll', update, true);
		};
	}, [active, currentIndex, filteredSteps]);

	// Keyboard support: Escape to exit, arrows to navigate
	useEffect(() => {
		if (!active) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') { onComplete(); return; }
			if (e.key === 'ArrowRight' || e.key === 'Enter') {
				setCurrentIndex((i) => {
					if (i >= filteredSteps.length - 1) { onComplete(); return i; }
					return i + 1;
				});
			}
			if (e.key === 'ArrowLeft') {
				setCurrentIndex((i) => Math.max(0, i - 1));
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [active, filteredSteps.length, onComplete]);

	const handleNext = useCallback(() => {
		if (currentIndex >= filteredSteps.length - 1) { onComplete(); return; }
		setCurrentIndex((i) => i + 1);
	}, [currentIndex, filteredSteps.length, onComplete]);

	const handleBack = useCallback(() => {
		setCurrentIndex((i) => Math.max(0, i - 1));
	}, []);

	if (!active || filteredSteps.length === 0) return null;

	const step = filteredSteps[currentIndex];
	const isLast = currentIndex === filteredSteps.length - 1;

	// Position tooltip below/above target
	const pad = 12;
	let tooltipStyle: React.CSSProperties = { position: 'fixed', zIndex: 10001, maxWidth: 360 };
	if (targetRect) {
		const belowSpace = window.innerHeight - targetRect.bottom;
		if (belowSpace > 180) {
			tooltipStyle = { ...tooltipStyle, top: targetRect.bottom + pad, left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 380)) };
		} else {
			tooltipStyle = { ...tooltipStyle, top: Math.max(16, targetRect.top - pad - 180), left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 380)) };
		}
	} else {
		tooltipStyle = { ...tooltipStyle, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
	}

	return (
		<AnimatePresence>
			{active && (
				<>
					{/* Backdrop overlay */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-[10000]"
						style={{ pointerEvents: 'auto' }}
						onClick={(e) => e.stopPropagation()}
					>
						{/* SVG mask-based spotlight */}
						<svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
							<defs>
								<mask id="tutorial-mask">
									<rect x="0" y="0" width="100%" height="100%" fill="white" />
									{targetRect && (
										<rect
											x={targetRect.left - 4}
											y={targetRect.top - 4}
											width={targetRect.width + 8}
											height={targetRect.height + 8}
											rx={6}
											fill="black"
										/>
									)}
								</mask>
							</defs>
							<rect
								x="0" y="0" width="100%" height="100%"
								fill="rgba(0,0,0,0.55)"
								mask="url(#tutorial-mask)"
							/>
						</svg>

						{/* Spotlight ring */}
						{targetRect && (
							<motion.div
								className="absolute border-2 border-primary rounded-md pointer-events-none"
								initial={{ opacity: 0, scale: 1.1 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ duration: 0.25 }}
								style={{
									left: targetRect.left - 4,
									top: targetRect.top - 4,
									width: targetRect.width + 8,
									height: targetRect.height + 8,
								}}
							/>
						)}
					</motion.div>

					{/* Tooltip card */}
					<motion.div
						key={currentIndex}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 8 }}
						transition={{ duration: 0.2 }}
						style={tooltipStyle}
						className="rounded-lg border border-border bg-background shadow-xl p-4"
						onClick={(e) => e.stopPropagation()}
					>
						{/* Progress bar */}
						<div className="flex items-center gap-2 mb-3">
							<div className="flex gap-1 flex-1">
								{filteredSteps.map((_, i) => (
									<div
										key={i}
										className={`h-1 flex-1 rounded-full transition-colors ${
											i <= currentIndex ? 'bg-primary' : 'bg-border'
										}`}
									/>
								))}
							</div>
							<span className="text-[0.625rem] text-muted-foreground shrink-0 tabular-nums">
								{currentIndex + 1} of {filteredSteps.length}
							</span>
						</div>

						<h3 className="text-sm font-semibold text-foreground mb-1">{step.title}</h3>
						<p className="text-xs text-muted-foreground leading-relaxed">{step.content}</p>

						{/* Controls */}
						<div className="flex items-center gap-2 mt-4">
							<Button
								variant="ghost"
								size="sm"
								className="h-7 text-xs text-muted-foreground"
								onClick={onComplete}
							>
								Skip
							</Button>
							<div className="flex-1" />
							{currentIndex > 0 && (
								<Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleBack}>
									<ChevronLeft className="size-3 mr-1" />
									Back
								</Button>
							)}
							<Button variant="default" size="sm" className="h-7 text-xs" onClick={handleNext}>
								{isLast ? 'Finish' : 'Next'}
								{!isLast && <ChevronRight className="size-3 ml-1" />}
							</Button>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}

/* ─── Tutorial hook for persisted state ─── */

export function useTutorial(storageKey: string) {
	const [active, setActive] = useState(false);
	const [hasCompleted, setHasCompleted] = useState(() => {
		try { return localStorage.getItem(storageKey) === 'true'; }
		catch { return false; }
	});

	const start = useCallback(() => setActive(true), []);

	const complete = useCallback(() => {
		setActive(false);
		setHasCompleted(true);
		try { localStorage.setItem(storageKey, 'true'); } catch { /* ignore */ }
	}, [storageKey]);

	// Auto-start on first visit
	useEffect(() => {
		if (!hasCompleted) {
			// Small delay so the page finishes rendering and targets are available
			const t = setTimeout(() => setActive(true), 800);
			return () => clearTimeout(t);
		}
	}, [hasCompleted]);

	return { active, start, complete, hasCompleted };
}
