import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './design/tokens.css';
// Browser-only: registers the service worker and wires the install / update
// events into usePwaStore. Kept out of every route module so the Node render in
// scripts/check-screens.tsx never pulls in `virtual:pwa-register`.
import './pwa/register.ts';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Drop the first-paint splash once React has painted the real app (surface 11).
// A frame after render is enough; the CSS fade (skipped under reduced motion)
// covers the handoff.
requestAnimationFrame(() => {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('is-leaving');
  const remove = () => splash.remove();
  splash.addEventListener('transitionend', remove, { once: true });
  // Fallback if transitionend doesn't fire (reduced motion zeroes the duration).
  setTimeout(remove, 500);
});
