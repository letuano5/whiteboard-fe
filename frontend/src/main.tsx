import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './app/App';
import { bootstrapApp } from './app/bootstrap';
import { isDashboardPath, restoreGhPagesRedirect } from './app/routing';
import { initRenderBenchmarkFromQuery } from './benchmark/render-benchmark';

restoreGhPagesRedirect();

const roomId = new URLSearchParams(window.location.search).get('room') ?? '';
const route = isDashboardPath(window.location.pathname) ? 'dashboard' : 'canvas';

void bootstrapApp(roomId, { route }).then(() => {
  initRenderBenchmarkFromQuery();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
