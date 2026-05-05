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
	leftTab: 'violations' | 'unassigned' | 'locks' | 'requests';
	setLeftTab: (tab: 'violations' | 'unassigned' | 'locks' | 'requests') => void;
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
								<button type="button" className="relative flex items-center justify-center h-8 w-8 rounded hover:bg-muted transition-colors" onClick={() => { panelRef.current?.expand(); setLeftTab('violations'); }}>
									<ShieldAlert className="size-4 text-muted-foreground" />
									{violationsCount > 0 && !isPreGenerationWorkspace && (
										<span className="absolute -top-1 -right-1 text-[0.5rem] font-bold leading-none bg-red-500 text-white rounded-full px-1">{violationsCount}</span>
									)}
								</button>
							</TooltipTrigger>
							<TooltipContent side="right">Violations</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<button type="button" className="relative flex items-center justify-center h-8 w-8 rounded hover:bg-muted transition-colors" onClick={() => { panelRef.current?.expand(); setLeftTab('unassigned'); }}>
									<AlertTriangle className="size-4 text-muted-foreground" />
									{unassignedCount > 0 && !isPreGenerationWorkspace && (
										<span className="absolute -top-1 -right-1 text-[0.5rem] font-bold leading-none bg-amber-500 text-white rounded-full px-1">{unassignedCount}</span>
									)}
								</button>
							</TooltipTrigger>
							<TooltipContent side="right">Unassigned</TooltipContent>
						</Tooltip>
						{isPreGenerationWorkspace && (
							<Tooltip>
								<TooltipTrigger asChild>
									<button type="button" className="flex items-center justify-center h-8 w-8 rounded hover:bg-muted transition-colors" onClick={() => { panelRef.current?.expand(); setLeftTab('locks'); }}>
										<Lock className="size-4 text-muted-foreground" />
									</button>
								</TooltipTrigger>
								<TooltipContent side="right">Pinned Sessions</TooltipContent>
							</Tooltip>
						)}
						<Tooltip>
							<TooltipTrigger asChild>
								<button type="button" className="relative flex items-center justify-center h-8 w-8 rounded hover:bg-muted transition-colors" onClick={() => { panelRef.current?.expand(); setLeftTab('requests'); }}>
									<ClipboardList className="size-4 text-muted-foreground" />
									{pendingRequestCount > 0 && (
										<span className="absolute -top-1 -right-1 text-[0.5rem] font-bold leading-none bg-blue-600 text-white rounded-full px-1">{pendingRequestCount}</span>
									)}
								</button>
							</TooltipTrigger>
							<TooltipContent side="right">Room Requests</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			) : (
				<>
					<div className="shrink-0 flex border-b border-border" role="tablist" aria-label="Schedule review panels" data-tutorial="left-tabs">
						<button
							id="tab-violations"
							type="button"
							role="tab"
							aria-selected={leftTab === 'violations'}
							aria-controls="panel-violations"
							hidden={isPreGenerationWorkspace}
							onClick={() => setLeftTab('violations')}
							className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
								leftTab === 'violations'
									? 'text-foreground border-b-2 border-primary'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							Violations
							<span className="ml-1 text-[0.625rem] opacity-70">{violationsCount}</span>
						</button>
						<button
							id="tab-unassigned"
							type="button"
							role="tab"
							aria-selected={leftTab === 'unassigned'}
							aria-controls="panel-unassigned"
							onClick={() => setLeftTab('unassigned')}
							hidden={isPreGenerationWorkspace}
							className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
								leftTab === 'unassigned'
									? 'text-foreground border-b-2 border-primary'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							Unassigned
							{unassignedCount > 0 && !isPreGenerationWorkspace && (
								<span className="ml-1 text-[0.625rem] text-amber-600 font-semibold">{unassignedCount}</span>
							)}
						</button>
						{isPreGenerationWorkspace && (
							<button
								id="tab-locks"
								type="button"
								role="tab"
								aria-selected={leftTab === 'locks'}
								aria-controls="panel-locks"
								onClick={() => setLeftTab('locks')}
								className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
									leftTab === 'locks'
										? 'text-foreground border-b-2 border-primary'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								<Lock className="inline size-3 mr-0.5 -mt-px" />
								Pins
							</button>
						)}
						<button
							id="tab-requests"
							type="button"
							role="tab"
							aria-selected={leftTab === 'requests'}
							aria-controls="panel-requests"
							onClick={() => setLeftTab('requests')}
							className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
								leftTab === 'requests'
									? 'text-foreground border-b-2 border-primary'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							<ClipboardList className="inline size-3 mr-0.5 -mt-px" />
							Requests
							{pendingRequestCount > 0 && (
								<span className="ml-1 text-[0.625rem] text-blue-700 font-semibold">{pendingRequestCount}</span>
							)}
						</button>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0 shrink-0 ml-auto"
							onClick={() => panelRef.current?.collapse()}
							aria-label="Collapse left panel"
						>
							<PanelLeftClose className="size-4" />
						</Button>
					</div>
					{children}
				</>
			)}
		</ViolationsSidebar>
	);
}
