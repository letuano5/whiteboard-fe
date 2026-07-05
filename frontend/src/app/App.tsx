import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AuthMenu } from '../auth/AuthMenu';
import { useAuthStore } from '../auth/auth.store';
import Whiteboard from '../canvas/Whiteboard';
import { DocumentDashboard } from '../documents/DocumentDashboard';
import { useRoomAccessStore } from '../rooms/room-access.store';
import { registerMutationHook } from '../store/mutation-pipeline';
import { createArrowBindingHook } from '../sync/arrow-binding-hook';
import { initSocketClient, stopSocketClient } from '../sync/socket-client';
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
      <Whiteboard mode={boardMode} />
    </div>
  );
}

function AccessDeniedScreen({
  isAuthenticated,
  message,
  code,
}: {
  isAuthenticated: boolean;
  message: string;
  code: string | null;
}) {
  const title = isAuthenticated ? "You don't have access" : 'Login required';
  const body = isAuthenticated
    ? 'This board is private. Ask the owner to add your email before opening it.'
    : 'This board is private. Login with an account that has access to open it.';

  return (
    <div className="grid min-h-screen place-items-center bg-[#f6f8f3] px-4 text-[#18231d]">
      <div className="absolute right-4 top-4">
        <AuthMenu />
      </div>
      <section className="w-[min(440px,calc(100vw-32px))] rounded-lg border border-[#d7dfd8] bg-white p-6 text-center shadow-[0_20px_60px_rgba(28,41,33,0.14)]">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#fff8e8] text-[#9a5b13]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-xs font-semibold uppercase text-[#68766a]">{code ?? 'room-access'}</p>
        <h1 className="mt-2 text-xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#4c5d52]">{body}</p>
        <p
          role="alert"
          className="mt-4 rounded-md border border-[#dfb86a] bg-[#fff8e8] p-3 text-sm text-[#795014]"
        >
          {message}
        </p>
      </section>
    </div>
  );
}
