import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './app/App';
import { initLocalStoragePersistence, startLocalStoragePersistence } from './sync/local-storage';
import { initHistoryCapture } from './sync/history-capture';

initHistoryCapture();
initLocalStoragePersistence();
startLocalStoragePersistence();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
