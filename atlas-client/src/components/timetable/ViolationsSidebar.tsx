import { useEffect, useState, type ReactNode } from 'react';

import { ResizablePanel } from '@/ui/resizable';

interface ViolationsSidebarProps {
	panelRef: any;
	onCollapseChange: (collapsed: boolean) => void;
	isDesktop: boolean;
	children: ReactNode;
}

export function ViolationsSidebar({
	panelRef,
	onCollapseChange,
	isDesktop,
	children,
}: ViolationsSidebarProps) {
	const [viewport, setViewport] = useState(() => ({
		width: typeof window !== 'undefined' ? window.innerWidth : 1366,
		isCompact: typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
	}));

	useEffect(() => {
		const syncViewport = () => setViewport({
			width: window.innerWidth,
			isCompact: window.innerWidth < 1024,
		});
		syncViewport();
		window.addEventListener('resize', syncViewport);
		return () => window.removeEventListener('resize', syncViewport);
	}, []);

	const readableMinPercent = viewport.isCompact
		? Math.min(72, Math.max(34, Math.ceil((280 / Math.max(viewport.width, 1)) * 100)))
		: Math.min(32, Math.max(22, Math.ceil((300 / Math.max(viewport.width, 1)) * 100)));

	return (
		<ResizablePanel
			ref={panelRef}
			id="left-panel"
			order={1}
			minSize={readableMinPercent}
			maxSize={viewport.isCompact ? 82 : 42}
			defaultSize={viewport.isCompact ? Math.max(48, readableMinPercent) : 28}
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
