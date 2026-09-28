import { useState } from 'react';
import { Bell, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { resolveNotificationRoute, useNotificationInbox, type InboxNotification } from '@/hooks/useNotificationInbox';
import { notificationRead } from '@/lib/notification-presentation';
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
	// A5-C2B / demo-walk item 5: the row reads the item through
	// `notificationRead`, which names the change in the operator's words and
	// strips the stored `MOVE_ENTRY` / `entry-321::t2` tokens the operator
	// reported. The FULL stored text is still on the row — behind one
	// disclosure — so nothing is lost, it is simply no longer the first thing
	// read.
	const read = notificationRead(item);
	const [detailOpen, setDetailOpen] = useState(false);
	const target = resolveNotificationRoute(item.resourceType, item.resourceId);

	// `whitespace-normal` and no `truncate`/`line-clamp` on the summary: the
	// narrow popover used to HARD-CLIP a long notice mid-word with no way to
	// see the rest. The text now wraps, and the panel's own
	// `max-h-80 overflow-y-auto` region does the scrolling (AGENTS.md §8
	// no-scroll architecture), so the message is fully readable in place.
	//
	// The ROW IS A CONTAINER, NOT A BUTTON. The detail disclosure is a control
	// inside it, and nesting one interactive button inside another is invalid
	// HTML whose click also bubbles to the row's navigation — the operator would
	// land on the target just by asking to read the detail. So the navigation
	// lives on the summary alone, and only when a route target actually exists;
	// an item with no target renders inert, exactly as before this change.
	const summaryClass = cn(
		'block text-left font-medium whitespace-normal break-words',
		target
			? 'text-foreground hover:underline'
			: 'text-foreground',
	);

	const body = (
		<span className="flex min-w-0 items-start gap-2">
			{!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />}
			<span className={cn('min-w-0', item.read && 'pl-4')}>
				{target ? (
					<Button
						type="button"
						variant="link"
						data-testid="notification-bell-open"
						aria-label={`Open notification: ${read.summary}`}
						onClick={() => onOpen(item)}
						className={cn('h-auto p-0 text-sm', summaryClass)}
					>
						{read.summary}
					</Button>
				) : (
					<span data-testid="notification-bell-summary" className={summaryClass}>{read.summary}</span>
				)}
				<span className="mt-1 block text-xs text-muted-foreground">{formatReceivedAt(item.createdAt)}</span>
				{read.detail && (
					<span className="mt-1 block">
						<Button
							type="button"
							variant="link"
							size="sm"
							data-testid="notification-bell-detail-toggle"
							aria-expanded={detailOpen}
							onClick={() => setDetailOpen((open) => !open)}
							className="h-auto p-0 text-xs"
						>
							{detailOpen ? 'Hide recorded detail' : 'Show recorded detail'}
							<ChevronDown className={cn('ml-1 size-3 transition-transform', detailOpen && 'rotate-180')} aria-hidden="true" />
						</Button>
						{detailOpen && (
							<span
								data-testid="notification-bell-detail"
								className="mt-1 block rounded-md bg-muted/50 px-2 py-1.5 text-xs whitespace-normal break-words text-muted-foreground"
							>
								{read.detail}
							</span>
						)}
					</span>
				)}
			</span>
		</span>
	);

	return (
		<div
			data-testid="notification-bell-item"
			data-read={item.read ? 'true' : 'false'}
			className={cn('w-full rounded-lg px-3 py-2.5 text-left text-sm', !item.read && 'bg-warning-muted')}
		>
			{body}
		</div>
	);
}

/**
 * NOTIFICATION-INBOX-C01 (D4) — the persisted inbox bell. `@/ui` primitives
 * only; the panel list scrolls inside its own `max-h` + `overflow-auto`
 * region so the no-scroll architecture holds (no global scrollbar).
 *
 * A5-C2B (demo-walk item 5): every row now states WHAT CHANGED in plain words
 * and reveals the recorded detail on demand. The row is deliberately not a link
 * when there is no route target, exactly as before — unchanged.
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
							className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-xs leading-none font-bold text-white"
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
