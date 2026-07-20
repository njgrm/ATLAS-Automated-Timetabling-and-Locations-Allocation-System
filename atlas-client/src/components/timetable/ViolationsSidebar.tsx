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
	const [isCompactViewport, setIsCompactViewport] = useState(() => (
		typeof window !== 'undefined' ? window.innerWidth < 1024 : false
	));

	useEffect(() => {
		const syncViewport = () => setIsCompactViewport(window.innerWidth < 1024);
		syncViewport();
		window.addEventListener('resize', syncViewport);
		return () => window.removeEventListener('resize', syncViewport);
	}, []);

	return (
		<ResizablePanel
			ref={panelRef}
			id="left-panel"
			order={1}
			minSize={isCompactViewport ? 34 : 12}
			maxSize={isCompactViewport ? 78 : 40}
			defaultSize={isCompactViewport ? 72 : 20}
			collapsible
			collapsedSize={isDesktop ? 3 : 0}
			onCollapse={() => onCollapseChange(true)}
			onExpand={() => onCollapseChange(false)}
			className="flex flex-col min-h-0 bg-background overflow-hidden border-r border-border"
		>
			{children}
		</ResizablePanel>
	);
}
