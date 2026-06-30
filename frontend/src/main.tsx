import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './app/App';
import { bootstrapApp } from './app/bootstrap';

const roomId = new URLSearchParams(window.location.search).get('room') ?? '';

void bootstrapApp(roomId);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
