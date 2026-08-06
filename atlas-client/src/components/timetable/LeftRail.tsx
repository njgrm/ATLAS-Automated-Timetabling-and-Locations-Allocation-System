import type { ReactNode, RefObject } from 'react';
import {
	AlertTriangle,
	ClipboardList,
	Lock,
	PanelLeftClose,
	PanelLeftOpen,
	ShieldAlert,
} from 'lucide-react';
import type { ImperativePanelHandle } from 'react-resizable-panels';

import { Button } from '@/ui/button';
import { Separator } from '@/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

import { ViolationsSidebar } from './ViolationsSidebar';

type LeftRailProps = {
	panelRef: RefObject<ImperativePanelHandle | null>;
	onCollapseChange: (collapsed: boolean) => void;
	isCollapsed: boolean;
	isDesktop: boolean;
	isPreGenerationWorkspace: boolean;
	leftTab: 'violations' | 'unassigned' | 'pinned' | 'requests';
	setLeftTab: (tab: 'violations' | 'unassigned' | 'pinned' | 'requests') => void;
	violationsCount: number;
	unassignedCount: number;
	pendingRequestCount: number;
	children: ReactNode;
};

export function LeftRail({
	panelRef,
	onCollapseChange,
	isCollapsed,
	isDesktop,
	isPreGenerationWorkspace,
	leftTab,
	setLeftTab,
	violationsCount,
	unassignedCount,
	pendingRequestCount,
	children,
}: LeftRailProps) {
	const expandPanelForTask = () => {
		panelRef.current?.expand();
		if (typeof window !== 'undefined' && window.innerWidth < 1024) {
			panelRef.current?.resize(72);
		}
	};

	return (
		<ViolationsSidebar panelRef={panelRef as any} onCollapseChange={onCollapseChange} isDesktop={isDesktop}>
			{isCollapsed ? (
				<div className="flex flex-col items-center gap-2 pt-2 w-full h-full">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={expandPanelForTask} aria-label="Expand left panel">
									<PanelLeftOpen className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="right">Expand panel</TooltipContent>
						</Tooltip>
						<Separator />
						<Tooltip>
							<TooltipTrigger asChild>
								<Button type="button" variant="ghost" size="sm" className="relative h-8 w-8 p-0" onClick={() => { expandPanelForTask(); setLeftTab('violations'); }}>
									<ShieldAlert className="size-4 text-muted-foreground" />
									{violationsCount > 0 && !isPreGenerationWorkspace && (
										<span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-xs font-bold leading-none text-white">{violationsCount}</span>
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent side="right">Violations</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button type="button" variant="ghost" size="sm" className="relative h-8 w-8 p-0" onClick={() => { expandPanelForTask(); setLeftTab('unassigned'); }}>
									<AlertTriangle className="size-4 text-muted-foreground" />
									{unassignedCount > 0 && !isPreGenerationWorkspace && (
										<span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1 text-xs font-bold leading-none text-white">{unassignedCount}</span>
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent side="right">Unassigned</TooltipContent>
						</Tooltip>
						{isPreGenerationWorkspace && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { expandPanelForTask(); setLeftTab('pinned'); }}>
										<Lock className="size-4 text-muted-foreground" />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="right">Pinned Sessions</TooltipContent>
							</Tooltip>
						)}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button type="button" variant="ghost" size="sm" className="relative h-8 w-8 p-0" onClick={() => { expandPanelForTask(); setLeftTab('requests'); }}>
									<ClipboardList className="size-4 text-muted-foreground" />
									{pendingRequestCount > 0 && (
										<span className="absolute -right-1 -top-1 rounded-full bg-blue-600 px-1 text-xs font-bold leading-none text-white">{pendingRequestCount}</span>
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent side="right">Room Requests</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			) : (
				<>
					<div className="shrink-0 border-b border-border" data-tutorial="left-tabs">
						<div className="flex items-center justify-between gap-2 px-2 py-1.5 xl:px-3 xl:py-2 [@media(max-height:500px)]:hidden">
							<div>
								<p className="text-xs font-semibold text-foreground">Needs attention</p>
								<p className="hidden text-xs text-muted-foreground xl:block">Review blockers first, then requests.</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0 shrink-0"
								onClick={() => panelRef.current?.collapse()}
								aria-label="Collapse left panel"
							>
								<PanelLeftClose className="size-4" />
							</Button>
						</div>
						<div className="grid min-w-0 grid-cols-3 overflow-hidden" role="tablist" aria-label="Needs attention panels">
						<Button
							id="tab-violations"
							type="button"
							variant="ghost"
							size="sm"
							role="tab"
							aria-selected={leftTab === 'violations'}
							aria-controls="panel-violations"
							hidden={isPreGenerationWorkspace}
							onClick={() => setLeftTab('violations')}
							className={`h-7 min-w-0 overflow-hidden rounded-none px-1 py-1 text-center xl:h-8 xl:px-2 xl:py-2 text-xs font-medium transition-colors [@media(max-height:500px)]:h-6 [@media(max-height:500px)]:py-0 ${
								leftTab === 'violations'
									? 'text-foreground border-b-2 border-primary'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							<span className="min-w-0 truncate">Violations</span>
							<span className="ml-1 shrink-0 text-xs opacity-70">{violationsCount}</span>
						</Button>
						<Button
							id="tab-unassigned"
							type="button"
							variant="ghost"
							size="sm"
							role="tab"
							aria-selected={leftTab === 'unassigned'}
							aria-controls="panel-unassigned"
							onClick={() => setLeftTab('unassigned')}
							className={`h-7 min-w-0 overflow-hidden rounded-none px-1 py-1 text-center xl:h-8 xl:px-2 xl:py-2 text-xs font-medium transition-colors [@media(max-height:500px)]:h-6 [@media(max-height:500px)]:py-0 ${
								leftTab === 'unassigned'
									? 'text-foreground border-b-2 border-primary'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							<span className="min-w-0 truncate">Unassigned</span>
							{unassignedCount > 0 && !isPreGenerationWorkspace && (
								<span className="ml-1 shrink-0 text-xs text-amber-600 font-semibold">{unassignedCount}</span>
							)}
						</Button>
						{isPreGenerationWorkspace && (
							<Button
								id="tab-pinned"
								type="button"
								variant="ghost"
								size="sm"
								role="tab"
								aria-selected={leftTab === 'pinned'}
								aria-controls="panel-pinned"
								onClick={() => setLeftTab('pinned')}
							className={`h-7 min-w-0 overflow-hidden rounded-none px-1 py-1 text-center xl:h-8 xl:px-2 xl:py-2 text-xs font-medium transition-colors [@media(max-height:500px)]:h-6 [@media(max-height:500px)]:py-0 ${
									leftTab === 'pinned'
										? 'text-foreground border-b-2 border-primary'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								<Lock className="mr-0.5 size-3 shrink-0" />
								<span className="min-w-0 truncate">Pinned</span>
							</Button>
						)}
						<Button
							id="tab-requests"
							type="button"
							variant="ghost"
							size="sm"
							role="tab"
							aria-selected={leftTab === 'requests'}
							aria-controls="panel-requests"
							onClick={() => setLeftTab('requests')}
							className={`h-7 min-w-0 overflow-hidden rounded-none px-1 py-1 text-center xl:h-8 xl:px-2 xl:py-2 text-xs font-medium transition-colors [@media(max-height:500px)]:h-6 [@media(max-height:500px)]:py-0 ${
								leftTab === 'requests'
									? 'text-foreground border-b-2 border-primary'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							<ClipboardList className="mr-0.5 size-3 shrink-0" />
							<span className="min-w-0 truncate">Requests</span>
							{pendingRequestCount > 0 && (
								<span className="ml-1 shrink-0 text-xs text-blue-700 font-semibold">{pendingRequestCount}</span>
							)}
						</Button>
						</div>
					</div>
					{children}
				</>
			)}
		</ViolationsSidebar>
	);
}
