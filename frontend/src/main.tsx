import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './app/App';
import { initLocalStoragePersistence, startLocalStoragePersistence } from './sync/local-storage';
import { initHistoryCapture } from './sync/history-capture';
import { initBroadcastChannel } from './sync/broadcast-channel';

initHistoryCapture();
initLocalStoragePersistence();
startLocalStoragePersistence();
initBroadcastChannel();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
