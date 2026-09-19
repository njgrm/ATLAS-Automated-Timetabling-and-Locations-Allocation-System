import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';

import { App } from './App';
import './index.css';
import { applyCachedAccentTheme } from '@/lib/settings';
import { timetableQueryClient } from '@/lib/timetable-data/timetableQueryClient';

// Apply last-known accent immediately to avoid default-blue flash before settings fetch resolves.
applyCachedAccentTheme();

createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<QueryClientProvider client={timetableQueryClient}>
			<App />
		</QueryClientProvider>
	</React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js').catch(() => {
			// Ignore service worker registration errors in unsupported environments.
		});
	});
} else if ('serviceWorker' in navigator && import.meta.env.DEV) {
	void navigator.serviceWorker.getRegistrations().then((registrations) =>
		Promise.all(registrations.map((registration) => registration.unregister())),
	);
}
