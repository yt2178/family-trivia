import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

// Automatically clean up any active Service Workers from other projects sharing the same domain (e.g. GitHub Pages)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length > 0) {
      Promise.all(registrations.map(r => r.unregister())).then(() => {
        console.log('[Service Worker] Active Service Workers detected and unregistered. Reloading to clear cache.');
        window.location.reload();
      });
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
