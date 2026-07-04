import { useAuthStore } from '../auth/auth.store';
import { loadCamera, startCameraPersistence } from '../sync/camera-persistence';
import { initLocalStoragePersistence, startLocalStoragePersistence } from '../sync/local-storage';
import { initBroadcastChannel } from '../sync/broadcast-channel';
import { initHistoryCapture } from '../sync/history-capture';
import { initSocketClient } from '../sync/socket-client';

export interface BootstrapOptions {
  route?: 'canvas' | 'dashboard';
}

export async function bootstrapApp(roomId: string, options: BootstrapOptions = {}): Promise<void> {
  if (options.route === 'dashboard') {
    await useAuthStore.getState().initAuth();
    return;
  }

  initHistoryCapture();
  await useAuthStore.getState().initAuth();

  if (!roomId) {
    initLocalStoragePersistence();
    startLocalStoragePersistence();
    initBroadcastChannel();
    return;
  }

  loadCamera(roomId);
  startCameraPersistence(roomId);
  initSocketClient(roomId);
}
