import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, LogIn, Save, X } from 'lucide-react';
import { AuthPanel } from '../auth/AuthPanel';
import { useAuthStore, type AuthStoreState } from '../auth/auth.store';
import { useCameraStore } from '../store/camera.store';
import { useElementsStore } from '../store/elements.store';
import { saveCamera } from '../sync/camera-persistence';
import { clearLocalScene } from '../sync/local-storage';
import { saveLocalBoard } from './local-board-save';

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
      const result = await saveLocalBoard({ elements, camera });
      saveCamera(result.roomId, camera);
      clearLocalScene();
      window.history.pushState({}, '', '/?room=' + result.roomId);
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
        className="flex h-10 items-center gap-2 rounded-lg bg-[#173f35] px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(23,63,53,0.22)] transition-colors hover:bg-[#0f2d26] focus:outline-none focus:ring-2 focus:ring-[#2457c5] focus:ring-offset-2"
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        {isAuthenticated ? 'Save board' : 'Login to save'}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-[80] w-[min(360px,calc(100vw-24px))] rounded-lg border border-[#b7c7b7] bg-[#fbfdf9] p-4 text-[#18231d] shadow-[0_20px_60px_rgba(28,41,33,0.18)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-[#68766a]">Local board</p>
              <h2 className="mt-1 text-lg font-semibold">
                {isAuthenticated ? 'Saving board' : 'Login to save'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                if (isSaving) return;
                setIsOpen(false);
                setSaveRequested(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#cbd9cb] bg-white text-[#314039] hover:bg-[#edf5ef]"
              aria-label="Close"
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-3 rounded-lg border border-[#cbd9cb] bg-white px-3 py-3">
              {isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#173f35]" />
              ) : (
                <Save className="h-5 w-5 text-[#173f35]" />
              )}
              <p className="text-sm leading-5 text-[#4c5d52]">
                Creating a saved document from the current local canvas.
              </p>
            </div>
          ) : (
            <AuthPanel />
          )}

          {isAuthLoading && !isAuthenticated ? (
            <p className="mt-3 text-sm text-[#4c5d52]">Checking session...</p>
          ) : null}

          {errorMessage ? (
            <p
              role="alert"
              className="mt-3 flex gap-2 rounded-lg border border-[#dfb86a] bg-[#fff8e8] px-3 py-2 text-sm text-[#795014]"
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
