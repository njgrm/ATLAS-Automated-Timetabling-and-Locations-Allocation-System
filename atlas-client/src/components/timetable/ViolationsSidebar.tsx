import type { ReactNode } from 'react';

import { ResizablePanel } from '@/ui/resizable';

interface ViolationsSidebarProps {
	panelRef: any;
	onCollapseChange: (collapsed: boolean) => void;
	children: ReactNode;
}

export function ViolationsSidebar({
	panelRef,
	onCollapseChange,
	children,
}: ViolationsSidebarProps) {
	return (
		<ResizablePanel
			ref={panelRef}
			id="left-panel"
			order={1}
			minSize={12}
			maxSize={40}
			defaultSize={20}
			collapsible
			collapsedSize={3}
			onCollapse={() => onCollapseChange(true)}
			onExpand={() => onCollapseChange(false)}
			className="flex flex-col min-h-0 bg-background overflow-hidden border-r border-border"
		>
			{children}
		</ResizablePanel>
	);
}
