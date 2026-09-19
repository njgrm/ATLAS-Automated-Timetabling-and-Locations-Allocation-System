import { useEffect, useState, type ReactNode } from 'react';

import { ResizablePanel } from '@/ui/resizable';

interface ViolationsSidebarProps {
	panelRef: any;
	onCollapseChange: (collapsed: boolean) => void;
	isDesktop: boolean;
	children: ReactNode;
}

export function resolveWarningPanelSizing(width: number): {
	minSize: number;
	maxSize: number;
	defaultSize: number;
} {
	const safeWidth = Math.max(width, 1);
	const isCompact = safeWidth < 1024;
	const minSize = isCompact
		? Math.min(72, Math.max(34, Math.ceil((280 / safeWidth) * 100)))
		: Math.min(32, Math.max(22, Math.ceil((300 / safeWidth) * 100)));
	return {
		minSize,
		maxSize: isCompact ? 82 : 42,
		defaultSize: isCompact ? Math.max(48, minSize) : 28,
	};
}

export function ViolationsSidebar({
	panelRef,
	onCollapseChange,
	isDesktop,
	children,
}: ViolationsSidebarProps) {
	const [viewport, setViewport] = useState(() => ({
		width: typeof window !== 'undefined' ? window.innerWidth : 1366,
	}));

	useEffect(() => {
		const syncViewport = () => setViewport({
			width: window.innerWidth,
		});
		syncViewport();
		window.addEventListener('resize', syncViewport);
		return () => window.removeEventListener('resize', syncViewport);
	}, []);

	const panelSizing = resolveWarningPanelSizing(viewport.width);

	return (
		<ResizablePanel
			ref={panelRef}
			id="left-panel"
			order={1}
			minSize={panelSizing.minSize}
			maxSize={panelSizing.maxSize}
			defaultSize={panelSizing.defaultSize}
			collapsible
			collapsedSize={isDesktop ? 3 : 0}
			onCollapse={() => onCollapseChange(true)}
			onExpand={() => onCollapseChange(false)}
			className="flex flex-col min-h-0 bg-background overflow-hidden border-r border-border"
			data-testid="timetable-left-panel"
		>
			{children}
		</ResizablePanel>
	);
}
