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
	isPreGenerationWorkspace,
	leftTab,
	setLeftTab,
	violationsCount,
	unassignedCount,
	pendingRequestCount,
	children,
}: LeftRailProps) {
	return (
		<ViolationsSidebar panelRef={panelRef as any} onCollapseChange={onCollapseChange}>
			{isCollapsed ? (
				<div className="flex flex-col items-center gap-2 pt-2 w-full h-full">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => panelRef.current?.expand()} aria-label="Expand left panel">
									<PanelLeftOpen className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="right">Expand panel</TooltipContent>
						</Tooltip>
						<Separator />
						<Tooltip>
							<TooltipTrigger asChild>
								<Button type="button" variant="ghost" size="sm" className="relative h-8 w-8 p-0" onClick={() => { panelRef.current?.expand(); setLeftTab('violations'); }}>
									<ShieldAlert className="size-4 text-muted-foreground" />
									{violationsCount > 0 && !isPreGenerationWorkspace && (
										<span className="absolute -top-1 -right-1 text-[10px] font-bold leading-none bg-red-500 text-white rounded-full px-1">{violationsCount}</span>
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent side="right">Violations</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button type="button" variant="ghost" size="sm" className="relative h-8 w-8 p-0" onClick={() => { panelRef.current?.expand(); setLeftTab('unassigned'); }}>
									<AlertTriangle className="size-4 text-muted-foreground" />
									{unassignedCount > 0 && !isPreGenerationWorkspace && (
										<span className="absolute -top-1 -right-1 text-[10px] font-bold leading-none bg-amber-500 text-white rounded-full px-1">{unassignedCount}</span>
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent side="right">Unassigned</TooltipContent>
						</Tooltip>
						{isPreGenerationWorkspace && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { panelRef.current?.expand(); setLeftTab('pinned'); }}>
										<Lock className="size-4 text-muted-foreground" />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="right">Pinned Sessions</TooltipContent>
							</Tooltip>
						)}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button type="button" variant="ghost" size="sm" className="relative h-8 w-8 p-0" onClick={() => { panelRef.current?.expand(); setLeftTab('requests'); }}>
									<ClipboardList className="size-4 text-muted-foreground" />
									{pendingRequestCount > 0 && (
										<span className="absolute -top-1 -right-1 text-[10px] font-bold leading-none bg-blue-600 text-white rounded-full px-1">{pendingRequestCount}</span>
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
						<div className="flex items-center justify-between gap-2 px-3 py-2">
							<div>
								<p className="text-xs font-semibold text-foreground">Needs attention</p>
								<p className="text-xs text-muted-foreground">Review blockers first, then requests.</p>
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
						<div className="flex" role="tablist" aria-label="Needs attention panels">
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
							className={`h-8 flex-1 rounded-none px-3 py-2 text-xs font-medium transition-colors ${
								leftTab === 'violations'
									? 'text-foreground border-b-2 border-primary'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							Violations
							<span className="ml-1 text-xs opacity-70">{violationsCount}</span>
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
							className={`h-8 flex-1 rounded-none px-3 py-2 text-xs font-medium transition-colors ${
								leftTab === 'unassigned'
									? 'text-foreground border-b-2 border-primary'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							Unassigned
							{unassignedCount > 0 && !isPreGenerationWorkspace && (
								<span className="ml-1 text-xs text-amber-600 font-semibold">{unassignedCount}</span>
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
								className={`h-8 flex-1 rounded-none px-3 py-2 text-xs font-medium transition-colors ${
									leftTab === 'pinned'
										? 'text-foreground border-b-2 border-primary'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								<Lock className="inline size-3 mr-0.5 -mt-px" />
								Pinned
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
							className={`h-8 flex-1 rounded-none px-3 py-2 text-xs font-medium transition-colors ${
								leftTab === 'requests'
									? 'text-foreground border-b-2 border-primary'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							<ClipboardList className="inline size-3 mr-0.5 -mt-px" />
							Requests
							{pendingRequestCount > 0 && (
								<span className="ml-1 text-xs text-blue-700 font-semibold">{pendingRequestCount}</span>
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
