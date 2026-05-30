import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	ExternalLink,
	Lock,
	LogOut,
	School,
} from 'lucide-react';

import { getBackHref } from '@/lib/bridge';
import type { BridgeUser } from '@/types';
import { Badge } from '@/ui/badge';
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
	advancedNav,
	buildValidateNav,
	campusNav,
	facultyNav,
	facultyPlanningNav,
	inputCollectionNav,
	navigationNav,
	setupNav,
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

function NavItemDisabled({
	icon: Icon,
	label,
}: {
	icon: React.ElementType;
	label: string;
}) {
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				tooltip={`${label} (Coming Soon)`}
				className='cursor-not-allowed opacity-40'
				disabled
			>
				<Icon className='size-4' />
				<span>{label}</span>
				<Lock className='ml-auto size-3' />
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
	const [userMenuOpen, setUserMenuOpen] = useState(false);

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
										<NavDivider label='Teacher Planning' />
										{renderNavGroup(facultyPlanningNav, isAdmin, pathname)}
										<NavDivider label='Campus' />
										{renderNavGroup(campusNav, isAdmin, pathname)}
										<NavDivider label='Input Collection' />
										{renderNavGroup(inputCollectionNav, isAdmin, pathname)}
										<NavDivider label='Build & Validate' />
										{renderNavGroup(buildValidateNav, isAdmin, pathname)}
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

								{!isFaculty && (
									<>
										<NavDivider label='Advanced' />
										{advancedNav.map((item) =>
											item.disabled ? (
												<NavItemDisabled key={item.to} icon={item.icon} label={item.label} />
											) : (
												<NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} pathname={pathname} />
											),
										)}
									</>
								)}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>

				<SidebarFooter>
					<SidebarMenu>
						<SidebarMenuItem>
							<div className='relative'>
								<SidebarMenuButton
									size='lg'
									tooltip={bridgeUser?.role ?? 'User'}
									onClick={() => setUserMenuOpen((o) => !o)}
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

								{userMenuOpen && (
									<>
										<div className='fixed inset-0 z-40' onClick={() => setUserMenuOpen(false)} />
										<div className='absolute bottom-full left-0 right-0 z-50 mb-1 rounded-md border border-border bg-popover p-1 shadow-md group-data-[collapsible=icon]:hidden'>
											<a
												href={getBackHref()}
												className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
											>
												<ExternalLink className='size-3.5' />
												<span>Back to EnrollPro</span>
											</a>
											<button
												type='button'
												onClick={() => { setUserMenuOpen(false); setShowLogoutConfirm(true); }}
												className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10'
											>
												<LogOut className='size-3.5' />
												<span>Sign out</span>
											</button>
										</div>
									</>
								)}
							</div>
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
