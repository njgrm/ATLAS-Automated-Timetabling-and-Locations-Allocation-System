import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	LogOut,
	School,
} from 'lucide-react';

import { getBackHref } from '@/lib/bridge';
import { prefetchNavDestination } from '@/lib/timetable-data/timetablePrefetch';
import type { BridgeUser } from '@/types';
import { Badge } from '@/ui/badge';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { Skeleton } from '@/ui/skeleton';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from '@/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { ConfirmationModal } from '@/ui/confirmation-modal';

import {
	auditNav,
	facultyNav,
	navigationNav,
	reviewPublishNav,
	setupNav,
	teachersAndRoomsNav,
	timetableNav,
	canSeeNavItem,
	type NavItemDef,
} from './navigation';
import { BackToEnrollProLink } from './BackToEnrollProLink';
import { IntegratedSystems } from './IntegratedSystems';

function enrollProAsset(path: string | null): string {
	if (!path) return '';
	return path.replace(/^\/uploads/, '/enrollpro-uploads');
}

function NavDivider({ label }: { label: string }) {
	return (
		<div className='px-3 py-2 mt-2 transition-[margin,opacity,height] duration-200 ease-linear group-data-[collapsible=icon]:m-0 group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:opacity-0 overflow-hidden'>
			<span className='text-xs font-semibold uppercase tracking-wider text-muted-foreground opacity-80 whitespace-nowrap'>
				{label}
			</span>
		</div>
	);
}

function NavItem({
	to,
	icon: Icon,
	label,
	pathname,
}: {
	to: string;
	icon: React.ElementType;
	label: string;
	pathname: string;
}) {
	const isActive = pathname === to;
	// UX-P01 R3: warm the lazy route chunk (and, for the Timetable entry point,
	// the scoped server-state queries) before the click so the destination route
	// renders from cache instead of a network-then-skeleton sequence.
	const handlePrefetch = () => prefetchNavDestination(to);
	return (
		<SidebarMenuItem>
			<SidebarMenuButton asChild isActive={isActive} tooltip={label}>
				<Link to={to} onMouseEnter={handlePrefetch} onFocus={handlePrefetch}>
					<Icon className='size-4' />
					<span>{label}</span>
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

function renderNavGroup(
	items: NavItemDef[],
	actor: BridgeUser | null,
	pathname: string,
) {
	return items
		.filter((item) => actor != null && canSeeNavItem(actor, item))
		.map((item) => (
			<NavItem
				key={item.to}
				to={item.to}
				icon={item.icon}
				label={item.label}
				pathname={pathname}
			/>
		));
}

export type AppSidebarProps = {
	schoolName: string;
	logoUrl: string | null;
	activeYearLabel: string | null;
	bridgeUser: BridgeUser | null;
	pathname: string;
	onLogout: () => void;
	className?: string;
};

export function AppSidebar({
	schoolName,
	logoUrl,
	activeYearLabel,
	bridgeUser,
	pathname,
	onLogout,
	className,
}: AppSidebarProps) {
	const isAdmin = bridgeUser?.role === 'admin' || bridgeUser?.role === 'SYSTEM_ADMIN' || bridgeUser?.role === 'officer';
	const isFaculty = bridgeUser?.role === 'faculty' || bridgeUser?.capabilities?.includes('faculty:self-service') === true;
	const isScheduler = bridgeUser?.capabilities?.includes('timetable:read') === true;
	const topNavigation = isFaculty && !isScheduler && !isAdmin ? [] : navigationNav;
	const backHref = getBackHref();
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
	const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
	const visibleLogoUrl = logoUrl && failedLogoUrl !== logoUrl ? enrollProAsset(logoUrl) : null;

	return (
		<>
			<Sidebar collapsible='icon' className={className}>
				<SidebarHeader>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								size='lg'
								className='data-[state=open]:bg-sidebar-accent cursor-default'
								tooltip={schoolName}
							>
								{visibleLogoUrl ? (
									<div className='flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden shrink-0'>
										<img src={visibleLogoUrl} alt='Logo' className='size-8 object-contain' onError={() => setFailedLogoUrl(logoUrl)} />
									</div>
								) : (
									<div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-muted shrink-0'>
										<School className='size-4 text-muted-foreground' />
									</div>
								)}
								<div className='grid flex-1 text-left text-sm leading-tight overflow-hidden'>
									{schoolName ? (
										<span className='truncate font-semibold'>{schoolName}</span>
									) : (
										<Skeleton className='h-3.5 w-28 my-0.5' />
									)}
									<div className='flex items-center gap-1 mt-0.5'>
										<span className='truncate text-xs uppercase tracking-wider font-semibold text-primary/80'>
											Scheduling Portal
										</span>
									</div>
									<div className='flex items-center gap-1 mt-0.5'>
										{activeYearLabel ? (
											<>
												<span className='truncate text-xs text-foreground'>S.Y. {activeYearLabel}</span>
												<span className='shrink-0 text-xs font-semibold text-emerald-600'>
													• ACTIVE
												</span>
											</>
										) : (
											<Tooltip>
												<TooltipTrigger asChild>
													<div className="flex items-center gap-1 cursor-help">
														<AlertTriangle className='size-3 shrink-0 text-amber-500' />
																<span className='text-xs text-muted-foreground'>Working from saved data</span>
													</div>
												</TooltipTrigger>
															<TooltipContent side="right" className="p-2 text-xs font-semibold">
													Unable to reach EnrollPro. Using saved school year data.
												</TooltipContent>
											</Tooltip>
										)}
									</div>
								</div>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>

				<SidebarSeparator />

				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<NavDivider label='Navigation' />
								{renderNavGroup(topNavigation, bridgeUser, pathname)}

								{(!isFaculty || isScheduler || isAdmin) && (
									<>
										{isAdmin && <><NavDivider label='School Setup' />{renderNavGroup(setupNav, bridgeUser, pathname)}</>}
										{(isAdmin || isScheduler) && <><NavDivider label='Teachers and Rooms' />{renderNavGroup(teachersAndRoomsNav, bridgeUser, pathname)}</>}
										{(isAdmin || isScheduler) && <><NavDivider label='Class Schedule' />{renderNavGroup(timetableNav, bridgeUser, pathname)}</>}
										{(isAdmin || isScheduler) && <><NavDivider label='Review and Publish' />{renderNavGroup(reviewPublishNav, bridgeUser, pathname)}</>}
										{isAdmin && <><NavDivider label='Audit' />{renderNavGroup(auditNav, bridgeUser, pathname)}</>}
									</>
								)}

								{isFaculty && (
									<>
										<NavDivider label='My Portal' />
										{facultyNav.map((item) => (
											<NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} pathname={pathname} />
										))}
									</>
								)}

								{!isFaculty && !isScheduler && (
									<>
										<NavDivider label='Integrated Systems' />
										<IntegratedSystems privilegedStaff={isAdmin} className='px-1' />
									</>
								)}

							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>

				<SidebarFooter>
					<SidebarMenu>
						<SidebarMenuItem>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<SidebarMenuButton
										size='lg'
										tooltip={bridgeUser?.role ?? 'User'}
										className='relative'
									>
										<div className='absolute inset-0 flex items-center justify-center transition-all duration-200 opacity-0 group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:scale-100 scale-75'>
											<LogOut className='size-4 text-muted-foreground' />
										</div>
										<div className='flex w-full items-center gap-2 transition-all duration-200 opacity-100 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:scale-95 group-data-[collapsible=icon]:pointer-events-none'>
											<div className='flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground overflow-hidden'>
												<span className='text-xs font-semibold'>
													{bridgeUser?.role ? bridgeUser.role.charAt(0).toUpperCase() : 'G'}
												</span>
											</div>
											<div className='grid flex-1 text-left text-sm leading-tight overflow-hidden'>
												<span className='truncate font-semibold'>{bridgeUser?.role ?? 'Guest'}</span>
												{isAdmin && (
																	<Badge variant='outline' className='mt-0.5 min-h-5 w-fit border-purple-200 bg-purple-50 px-1 text-xs font-bold text-purple-700'>
														Admin
													</Badge>
												)}
												{isFaculty && (
																	<span className='truncate text-xs text-muted-foreground'>Teacher</span>
												)}
												{!isAdmin && !isFaculty && (
																	<span className='truncate text-xs text-muted-foreground'>Portal access</span>
												)}
											</div>
										</div>
									</SidebarMenuButton>
								</DropdownMenuTrigger>
								<DropdownMenuContent side='right' align='end' sideOffset={8} className='w-48'>
									{backHref && (
										<DropdownMenuItem asChild>
											<BackToEnrollProLink href={backHref} className='flex items-center gap-2 text-xs text-muted-foreground' />
										</DropdownMenuItem>
									)}
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className='gap-2 text-xs text-destructive focus:bg-destructive/10 focus:text-destructive'
										onSelect={(event) => {
											event.preventDefault();
											setShowLogoutConfirm(true);
										}}
									>
										<LogOut className='size-3.5' />
										<span>Sign out</span>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
			</Sidebar>

			<ConfirmationModal
				open={showLogoutConfirm}
				onOpenChange={setShowLogoutConfirm}
				title='Sign Out'
				description='Are you sure you want to sign out of your account?'
				confirmText='Sign Out'
				onConfirm={onLogout}
				variant='primary'
			/>
		</>
	);
}
