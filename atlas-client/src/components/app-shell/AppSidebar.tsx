import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	ExternalLink,
	LogOut,
	School,
} from 'lucide-react';

import { getBackHref } from '@/lib/bridge';
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
	type NavItemDef,
} from './navigation';

function enrollProAsset(path: string | null): string {
	if (!path) return '';
	return path.replace(/^\/uploads/, '/enrollpro-uploads');
}

function NavDivider({ label }: { label: string }) {
	return (
		<div className='px-3 py-2 mt-2 transition-[margin,opacity,height] duration-200 ease-linear group-data-[collapsible=icon]:m-0 group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:opacity-0 overflow-hidden'>
			<span className='text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground opacity-80 whitespace-nowrap'>
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
	return (
		<SidebarMenuItem>
			<SidebarMenuButton asChild isActive={isActive} tooltip={label}>
				<Link to={to}>
					<Icon className='size-4' />
					<span>{label}</span>
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

function renderNavGroup(
	items: NavItemDef[],
	isAdmin: boolean,
	pathname: string,
) {
	return items
		.filter((item) => !item.adminOnly || isAdmin)
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
	const isFaculty = bridgeUser?.role === 'faculty';
	const topNavigation = isFaculty ? [] : navigationNav;
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
								{logoUrl ? (
									<div className='flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden shrink-0'>
										<img src={enrollProAsset(logoUrl)} alt='Logo' className='size-8 object-contain' />
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
										<span className='truncate text-[0.625rem] uppercase tracking-wider font-semibold text-primary/80'>
											Scheduling Portal
										</span>
									</div>
									<div className='flex items-center gap-1 mt-0.5'>
										{activeYearLabel ? (
											<>
												<span className='truncate text-[0.6875rem] text-foreground'>S.Y. {activeYearLabel}</span>
												<span className='shrink-0 text-[0.625rem] font-semibold text-emerald-600'>
													• ACTIVE
												</span>
											</>
										) : (
											<Tooltip>
												<TooltipTrigger asChild>
													<div className="flex items-center gap-1 cursor-help">
														<AlertTriangle className='size-3 shrink-0 text-amber-500' />
														<span className='text-[0.6875rem] text-muted-foreground'>Working from saved data</span>
													</div>
												</TooltipTrigger>
												<TooltipContent side="right" className="text-[0.65rem] font-semibold p-2">
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
								{renderNavGroup(topNavigation, isAdmin, pathname)}

								{!isFaculty && (
									<>
										<NavDivider label='School Setup' />
										{renderNavGroup(setupNav, isAdmin, pathname)}
										<NavDivider label='Teachers and Rooms' />
										{renderNavGroup(teachersAndRoomsNav, isAdmin, pathname)}
										<NavDivider label='Timetable' />
										{renderNavGroup(timetableNav, isAdmin, pathname)}
										<NavDivider label='Review and Publish' />
										{renderNavGroup(reviewPublishNav, isAdmin, pathname)}
										<NavDivider label='Audit' />
										{renderNavGroup(auditNav, isAdmin, pathname)}
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
													<Badge variant='outline' className='mt-0.5 w-fit h-4 px-1 text-[0.5625rem] font-bold border-purple-200 bg-purple-50 text-purple-700'>
														Admin
													</Badge>
												)}
												{isFaculty && (
													<span className='truncate text-[0.6875rem] text-muted-foreground'>Teacher</span>
												)}
												{!isAdmin && !isFaculty && (
													<span className='truncate text-[0.6875rem] text-muted-foreground'>Portal access</span>
												)}
											</div>
										</div>
									</SidebarMenuButton>
								</DropdownMenuTrigger>
								<DropdownMenuContent side='right' align='end' sideOffset={8} className='w-48'>
									<DropdownMenuItem asChild>
										<a href={getBackHref()} className='flex items-center gap-2 text-xs text-muted-foreground'>
											<ExternalLink className='size-3.5' />
											<span>Back to EnrollPro</span>
										</a>
									</DropdownMenuItem>
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
