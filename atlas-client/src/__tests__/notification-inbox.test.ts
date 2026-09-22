/**
 * NOTIFICATION-INBOX-C01 — client inbox proofs (no DOM, no network).
 *
 * Run (client workspace): `npm run test:notification-inbox`
 *   (`npx tsx --test src/__tests__/notification-inbox.test.ts`)
 *
 * Covers:
 *  1. The unread-count badge contract (trigger + count testids, 9+ cap).
 *  2. Mark-read / mark-all-read dispatch through the actor-scoped API client
 *     (source contract: no raw fetch, no school-1 default, epoch-bound).
 *  3. The resource routing target per resourceType, including the inert
 *     fallback (null ⇒ never a dead link that pretends to navigate).
 *  4. The no-global-scrollbar structural contract at 1366×768: the panel list
 *     scrolls inside its own max-h + overflow-auto region, and the shell keeps
 *     the no-scroll architecture.
 *  5. `@/ui` primitives only: no raw unstyled `<button>`, no `title`
 *     attribute, no raw `<details>`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { resolveNotificationRoute } from '../hooks/useNotificationInbox';

function readSource(relativePath: string): string {
	return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

const bell = () => readSource('../components/app-shell/NotificationBell.tsx');
const hook = () => readSource('../hooks/useNotificationInbox.ts');
const shell = () => readSource('../components/AppShell.tsx');

test('the bell trigger carries the unread count with a 9+ cap', () => {
	const source = bell();
	assert.ok(source.includes('data-testid="notification-bell-trigger"'), 'trigger testid');
	assert.ok(source.includes('data-testid="notification-bell-unread-count"'), 'unread count testid');
	assert.ok(source.includes("unreadCount > 9 ? '9+' : unreadCount"), 'counts above 9 render as 9+');
	assert.ok(
		source.includes('aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` :'),
		'the trigger announces its unread state to assistive tech',
	);
});

test('mark-read and mark-all-read dispatch through the actor-scoped API client', () => {
	const hookSource = hook();
	assert.ok(
		hookSource.includes("atlasApi.post(`/notification-inbox/${id}/read`)"),
		'mark-read POSTs the item route through atlasApi (token-injected, actor-scoped)',
	);
	assert.ok(
		hookSource.includes("atlasApi.post('/notification-inbox/read-all')"),
		'mark-all-read POSTs the collection route through atlasApi',
	);
	assert.equal(hookSource.includes('fetch('), false, 'no raw fetch bypasses the API client');
	assert.ok(
		hookSource.includes('getPreferredAccessToken()'),
		'writes are gated on the authenticated token epoch',
	);
	assert.ok(
		hookSource.includes('resolveActorSchoolId()'),
		'loads resolve the actor school from the session, never a default',
	);
	assert.ok(
		hookSource.includes('subscribeAtlasTokenEpoch'),
		'the binding drops the previous actor on any token mutation',
	);

	const bellSource = bell();
	assert.ok(bellSource.includes('void markRead(item.id)'), 'opening a routed item marks it read');
	assert.ok(bellSource.includes('void markAllRead()'), 'the panel exposes a Mark all read action');
	assert.ok(bellSource.includes('data-testid="notification-bell-mark-all-read"'), 'mark-all testid');
});

test('resource routing resolves per resourceType and stays inert without a pointer', () => {
	assert.equal(
		resolveNotificationRoute('timetable', '12'),
		'/timetable?runId=12',
		'timetable/generation rows route to the run',
	);
	assert.equal(
		resolveNotificationRoute('generation', '12'),
		'/timetable?runId=12',
		'generation rows route to the run',
	);
	assert.equal(
		resolveNotificationRoute('published-schedule', '7'),
		'/schedules?revision=7',
		'published-schedule rows route to the revision',
	);
	assert.equal(
		resolveNotificationRoute('preference', '9'),
		'/preferences?preferenceId=9',
		'preference rows route to the preference',
	);
	assert.equal(
		resolveNotificationRoute('room-request', '5'),
		'/rooms?requestId=5',
		'room-request rows route to the request',
	);
	assert.equal(
		resolveNotificationRoute('integration', '3'),
		'/admin/year-setup?event=3',
		'integration rows route to year setup',
	);
	assert.equal(resolveNotificationRoute(null, '12'), null, 'missing resourceType is inert');
	assert.equal(resolveNotificationRoute('timetable', null), null, 'missing resourceId is inert');
	assert.equal(resolveNotificationRoute('timetable', '  '), null, 'blank resourceId is inert');
	assert.equal(resolveNotificationRoute('unknown-domain', '12'), null, 'unknown domains never fabricate a route');

	const bellSource = bell();
	assert.ok(
		bellSource.includes('if (!target) return;'),
		'items without a target return before navigating (never a dead link)',
	);
});

test('the panel scrolls internally: no global scrollbar at 1366x768', () => {
	const bellSource = bell();
	assert.ok(
		bellSource.includes('max-h-80 overflow-y-auto'),
		'the list scrolls inside its own max-h + overflow-auto region',
	);
	assert.ok(
		bellSource.includes('data-testid="notification-bell-panel"'),
		'panel testid for the mounted layout proof',
	);
	const shellSource = shell();
	assert.ok(
		shellSource.includes('<NotificationBell />'),
		'the bell mounts inside the AppShell header, not in a page scroll container',
	);
});

test('the bell uses @/ui primitives only', () => {
	const bellSource = bell();
	assert.ok(
		bellSource.includes("from '@/ui/popover'"),
		'the panel is a @/ui Popover',
	);
	assert.ok(bellSource.includes('PopoverTrigger'), 'popover trigger primitive');
	assert.ok(bellSource.includes('PopoverContent'), 'popover content primitive');
	assert.ok(bellSource.includes("from '@/ui/button'"), '@/ui Button for actions');
	assert.equal(/<button[\s>]/.test(bellSource), false, 'no raw unstyled <button>');
	assert.equal(bellSource.includes('title='), false, 'no title attribute for extra information');
	assert.equal(bellSource.includes('<details'), false, 'no raw <details>');
});
