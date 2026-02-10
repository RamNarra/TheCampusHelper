import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const renderFatalError = (title: string, details?: string) => {
  try {
    const safeDetails = String(details || '').slice(0, 4000);
    document.documentElement.classList.remove('dark', 'light');
    document.body.style.margin = '0';
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b0f;color:#e6e6e6;font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;padding:24px;">
        <div style="max-width:780px;width:100%;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.04);padding:20px;">
          <div style="font-size:18px;font-weight:700;margin-bottom:8px;">${title.replace(/</g, '&lt;')}</div>
          <div style="opacity:.8;font-size:13px;line-height:1.45;white-space:pre-wrap;">${safeDetails.replace(/</g, '&lt;')}</div>
          <div style="margin-top:14px;opacity:.7;font-size:12px;">Open DevTools Console for the full error.</div>
        </div>
      </div>
    `;
  } catch {
    // last resort: ignore
  }
};

// Surface runtime failures (especially useful when CSP or dev overlays are blocked).
window.addEventListener('error', (e) => {
  const msg = (e as ErrorEvent)?.message || 'Unknown script error';
  const stack = (e as ErrorEvent)?.error?.stack || '';
  renderFatalError('App crashed during startup', [msg, stack].filter(Boolean).join('\n'));
});

window.addEventListener('unhandledrejection', (e) => {
  const reason = (e as PromiseRejectionEvent)?.reason;
  const msg = reason instanceof Error ? reason.message : String(reason || 'Unknown rejection');
  const stack = reason instanceof Error ? reason.stack : '';
  renderFatalError('Unhandled promise rejection during startup', [msg, stack].filter(Boolean).join('\n'));
});

// PWA/service-worker is intentionally disabled to prevent stale caching and ensure
// users receive fresh Vercel deployments.
const disableServiceWorkersAndCaches = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // best-effort cleanup
  }
};

void disableServiceWorkersAndCaches();

const rootElement = document.getElementById('root');
if (!rootElement) {
  renderFatalError('Startup error', 'Could not find #root element to mount to.');
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e || 'Unknown error');
  const stack = e instanceof Error ? e.stack : '';
  renderFatalError('App crashed during render', [msg, stack].filter(Boolean).join('\n'));
  throw e;
}