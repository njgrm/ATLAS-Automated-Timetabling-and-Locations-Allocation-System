import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './index.css';
import { applyCachedAccentTheme } from '@/lib/settings';

// Apply last-known accent immediately to avoid default-blue flash before settings fetch resolves.
applyCachedAccentTheme();

createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
