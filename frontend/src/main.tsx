import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './app/App';
import { initHistoryCapture } from './sync/history-capture';
import { initSocketClient } from './sync/socket-client';
import { loadCamera, startCameraPersistence } from './sync/camera-persistence';

const roomId = new URLSearchParams(window.location.search).get('room') ?? '';

initHistoryCapture();
if (roomId) {
  loadCamera(roomId);
  startCameraPersistence(roomId);
  initSocketClient(roomId);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
