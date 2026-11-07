import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Intercept benign third-party Chrome extension message timeouts
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = typeof reason === 'string' ? reason : reason?.message || '';
    const stack = reason?.stack || '';
    if (
      msg.includes('chrome: call method') ||
      msg.includes('chrome-extension://') ||
      stack.includes('chrome-extension://') ||
      msg.includes('popup-closed-by-user') ||
      msg.includes('cancelled-popup-request')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    const filename = event.filename || '';
    if (
      msg.includes('chrome: call method') ||
      msg.includes('chrome-extension://') ||
      filename.includes('chrome-extension://')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
