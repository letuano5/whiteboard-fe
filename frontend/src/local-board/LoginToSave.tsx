import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, LogIn, Save, X } from 'lucide-react';
import { AuthPanel } from '../auth/AuthPanel';
import { useAuthStore, type AuthStoreState } from '../auth/auth.store';
import { useCameraStore } from '../store/camera.store';
import { useElementsStore } from '../store/elements.store';
import { saveCamera } from '../sync/camera-persistence';
import { clearLocalScene } from '../sync/local-storage';
import { saveLocalBoard } from './local-board-save';
import { roomPath } from '../app/routing';

export function LoginToSave() {
  const session = useAuthStore((state: AuthStoreState) => state.session);
  const status = useAuthStore((state: AuthStoreState) => state.status);
  const elements = useElementsStore((state) => state.elements);
  const camera = useCameraStore((state) => state.camera);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveRequested, setSaveRequested] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const savingRef = useRef(false);

  const saveCurrentBoard = useCallback(async () => {
    savingRef.current = true;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const result = await saveLocalBoard({ elements: elements.filter((e) => !e.isDeleted), camera });
      saveCamera(result.roomId, camera);
      clearLocalScene();
      window.history.pushState({}, '', roomPath(result.roomId));
      window.location.reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save this board.');
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [camera, elements]);

  useEffect(() => {
    if (!saveRequested || !session || savingRef.current) return;
    void saveCurrentBoard();
  }, [saveCurrentBoard, saveRequested, session]);

  function handleLoginToSaveClick() {
    setErrorMessage(null);
    setSaveRequested(true);
    setIsOpen(true);

    if (session && !savingRef.current) {
      void saveCurrentBoard();
    }
  }

  const isAuthenticated = Boolean(session);
  const isAuthLoading = status === 'loading';

  return (
    <>
      <button
        type="button"
        onClick={handleLoginToSaveClick}
        disabled={isSaving}
        className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-paper shadow-md transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary-soft focus:ring-offset-2"
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        {isAuthenticated ? 'Save board' : 'Login to save'}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-[80] w-[min(360px,calc(100vw-24px))] rounded-lg border border-rule bg-paper p-4 text-ink shadow-lg">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">
              {isAuthenticated ? 'Saving board' : 'Login to save'}
            </h2>
            <button
              type="button"
              onClick={() => {
                if (isSaving) return;
                setIsOpen(false);
                setSaveRequested(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rule bg-paper text-muted hover:bg-panel"
              aria-label="Close"
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-3 rounded-lg border border-rule bg-panel px-3 py-3">
              {isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin text-ink" />
              ) : (
                <Save className="h-5 w-5 text-ink" />
              )}
              <p className="text-sm leading-5 text-muted">
                Creating a saved document from the current local canvas.
              </p>
            </div>
          ) : (
            <AuthPanel />
          )}

          {isAuthLoading && !isAuthenticated ? (
            <p className="mt-3 text-sm text-muted">Checking session...</p>
          ) : null}

          {errorMessage ? (
            <p
              role="alert"
              className="mt-3 flex gap-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {errorMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
