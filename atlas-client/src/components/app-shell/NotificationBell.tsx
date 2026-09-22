import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { resolveNotificationRoute, useNotificationInbox, type InboxNotification } from '@/hooks/useNotificationInbox';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { cn } from '@/lib/utils';

function formatReceivedAt(value: string): string {
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return value;
	return parsed.toLocaleString();
}

function NotificationRow({
	item,
	onOpen,
}: {
	item: InboxNotification;
	onOpen: (item: InboxNotification) => void;
}) {
	const target = resolveNotificationRoute(item.resourceType, item.resourceId);
	const body = (
		<span className="flex min-w-0 items-start gap-2">
			{!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />}
			<span className={cn('min-w-0', item.read && 'pl-4')}>
				<span className="block truncate font-medium text-foreground">{item.title}</span>
				{item.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.body}</span>}
				<span className="mt-1 block text-xs text-muted-foreground">{formatReceivedAt(item.createdAt)}</span>
			</span>
		</span>
	);
	if (!target) {
		return (
			<div
				data-testid="notification-bell-item"
				data-read={item.read ? 'true' : 'false'}
				className={cn('w-full rounded-lg px-3 py-2.5 text-left text-sm', !item.read && 'bg-amber-50')}
			>
				{body}
			</div>
		);
	}
	return (
		<Button
			type="button"
			variant="ghost"
			data-testid="notification-bell-item"
			data-read={item.read ? 'true' : 'false'}
			aria-label={`Open notification: ${item.title}`}
			onClick={() => onOpen(item)}
			className={cn(
				'h-auto w-full items-start justify-start rounded-lg px-3 py-2.5 text-left text-sm font-normal whitespace-normal',
				!item.read && 'bg-amber-50',
			)}
		>
			{body}
		</Button>
	);
}

/**
 * NOTIFICATION-INBOX-C01 (D4) — the persisted inbox bell. `@/ui` primitives
 * only; the panel list scrolls inside its own `max-h` + `overflow-auto`
 * region so the no-scroll architecture holds (no global scrollbar).
 */
export function NotificationBell() {
	const navigate = useNavigate();
	const { items, unreadCount, markRead, markAllRead } = useNotificationInbox();

	const handleOpen = (item: InboxNotification) => {
		const target = resolveNotificationRoute(item.resourceType, item.resourceId);
		if (!target) return;
		if (!item.read) void markRead(item.id);
		navigate(target);
	};

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					data-testid="notification-bell-trigger"
					aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
					className="relative h-9 w-9 text-muted-foreground hover:bg-primary/10 hover:text-primary"
				>
					<Bell className="h-4 w-4" aria-hidden="true" />
					{unreadCount > 0 && (
						<span
							data-testid="notification-bell-unread-count"
							className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-xs leading-none font-bold text-white"
						>
							{unreadCount > 9 ? '9+' : unreadCount}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				side="bottom"
				align="end"
				sideOffset={8}
				data-testid="notification-bell-panel"
				className="w-80 p-0"
			>
				<div className="flex items-center justify-between border-b border-border px-4 py-3">
					<p className="text-sm font-semibold text-foreground">Notifications</p>
					{unreadCount > 0 && (
						<Button
							type="button"
							variant="link"
							size="sm"
							data-testid="notification-bell-mark-all-read"
							onClick={() => void markAllRead()}
							className="h-auto p-0 text-xs"
						>
							Mark all read
						</Button>
					)}
				</div>
				<div className="max-h-80 overflow-y-auto p-2">
					{items.length === 0 ? (
						<p data-testid="notification-bell-empty" className="py-6 text-center text-sm text-muted-foreground">
							No notifications
						</p>
					) : (
						items.map((item) => <NotificationRow key={item.id} item={item} onOpen={handleOpen} />)
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
