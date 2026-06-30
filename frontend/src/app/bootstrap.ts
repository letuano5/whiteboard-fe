import { useAuthStore } from '../auth/auth.store';
import { loadCamera, startCameraPersistence } from '../sync/camera-persistence';
import { initHistoryCapture } from '../sync/history-capture';
import { initSocketClient } from '../sync/socket-client';

export async function bootstrapApp(roomId: string): Promise<void> {
  initHistoryCapture();
  await useAuthStore.getState().initAuth();

  if (!roomId) {
    return;
  }

  loadCamera(roomId);
  startCameraPersistence(roomId);
  initSocketClient(roomId);
}
