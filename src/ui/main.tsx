import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { menuGroups } from '../algorithms/index.js';
import { App } from './app.js';

const root = document.getElementById('root');
if (root === null) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App search={location.search} menuGroups={menuGroups} />
  </StrictMode>,
);
