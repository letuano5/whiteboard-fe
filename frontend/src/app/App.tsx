import { useEffect, useRef, useSyncExternalStore } from 'react';
import { RenderBenchmarkProbe } from '../benchmark/render-benchmark';
import { useAuthStore } from '../auth/auth.store';
import Whiteboard from '../canvas/Whiteboard';
import { DocumentDashboard } from '../documents/DocumentDashboard';
import { useRoomAccessStore } from '../rooms/room-access.store';
import { registerMutationHook } from '../store/mutation-pipeline';
import { createArrowBindingHook } from '../sync/arrow-binding-hook';
import { initSocketClient, stopSocketClient } from '../sync/socket-client';
import { AccessDeniedScreen } from './AccessDeniedScreen';
import { getLocationSnapshot, isDashboardPath, subscribeToLocation } from './routing';

export default function App() {
  const session = useAuthStore((state) => state.session);
  const authStatus = useAuthStore((state) => state.status);
  const accessErrorCode = useRoomAccessStore((state) => state.errorCode);
  const accessErrorMessage = useRoomAccessStore((state) => state.errorMessage);
  // Re-renders on navigate() and on browser back/forward, so switching to/from
  // the dashboard doesn't require a full page reload.
  useSyncExternalStore(subscribeToLocation, getLocationSnapshot);
  const roomId = new URLSearchParams(window.location.search).get('room');
  const previousAccessTokenRef = useRef<string | null | undefined>(undefined);

  // T020: Register arrow-binding mutation hook once on mount
  useEffect(() => {
    const unregister = registerMutationHook(createArrowBindingHook());
    return unregister;
  }, []);

  useEffect(() => {
    if (!roomId || authStatus === 'idle' || authStatus === 'loading') return;

    const accessToken = session?.accessToken ?? null;
    const previousAccessToken = previousAccessTokenRef.current;
    previousAccessTokenRef.current = accessToken;
    if (previousAccessToken === undefined || previousAccessToken === accessToken) return;

    stopSocketClient();
    initSocketClient(roomId);
  }, [authStatus, roomId, session?.accessToken]);

  const boardMode = roomId ? 'saved' : 'local';

  if (isDashboardPath(window.location.pathname)) {
    return <DocumentDashboard />;
  }

  if (roomId && accessErrorMessage) {
    return (
      <AccessDeniedScreen
        isAuthenticated={Boolean(session)}
        message={accessErrorMessage}
        code={accessErrorCode}
      />
    );
  }

  return (
    <div style={{ width: '100vw', height: '100dvh' }}>
      <RenderBenchmarkProbe />
      <Whiteboard mode={boardMode} />
    </div>
  );
}
