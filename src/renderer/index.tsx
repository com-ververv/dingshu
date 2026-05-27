/**
 * Desktop Starter App - Renderer Entry Point
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';

async function bootstrap() {
  if (import.meta.env.VITE_E2E_BROWSER === '1' && !window.api) {
    const { installE2EMockApi } = await import('./e2eMockApi');
    installE2EMockApi();
  }

  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Failed to find root element');
  }

  const { default: App } = await import('./App');
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void bootstrap();
