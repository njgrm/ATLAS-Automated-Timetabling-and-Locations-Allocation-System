import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import '../index.css';
import { A2A5UnassignedVisualFixture } from './A2A5UnassignedVisualFixture';

createRoot(document.getElementById('root')!).render(
	createElement(MemoryRouter, null, createElement(A2A5UnassignedVisualFixture)),
);
