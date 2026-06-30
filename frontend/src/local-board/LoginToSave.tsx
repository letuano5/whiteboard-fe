import { useState } from 'react';
import { AlertCircle, Check, Loader2, LogIn, X } from 'lucide-react';
import { AuthPanel } from '../auth/AuthPanel';
import { useAuthStore, type AuthStoreState } from '../auth/auth.store';
import { useCameraStore } from '../store/camera.store';
import { useElementsStore } from '../store/elements.store';
import { saveCamera } from '../sync/camera-persistence';
import { saveLocalBoard } from './local-board-save';

export function LoginToSave() {
  const session = useAuthStore((state: AuthStoreState) => state.session);
  const status = useAuthStore((state: AuthStoreState) => state.status);
  const elements = useElementsStore((state) => state.elements);
  const camera = useCameraStore((state) => state.camera);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleConfirmSave() {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const result = await saveLocalBoard({ elements, camera });
      saveCamera(result.roomId, camera);
      window.history.pushState({}, '', '/?room=' + result.roomId);
      window.location.reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save this board.');
      setIsSaving(false);
    }
  }

  const isAuthenticated = Boolean(session);
  const isAuthLoading = status === 'loading';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrorMessage(null);
          setIsOpen(true);
        }}
        className="flex h-10 items-center gap-2 rounded-lg bg-[#173f35] px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(23,63,53,0.22)] transition-colors hover:bg-[#0f2d26] focus:outline-none focus:ring-2 focus:ring-[#2457c5] focus:ring-offset-2"
      >
        <LogIn className="h-4 w-4" />
        Login to save
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-[80] w-[min(360px,calc(100vw-24px))] rounded-lg border border-[#b7c7b7] bg-[#fbfdf9] p-4 text-[#18231d] shadow-[0_20px_60px_rgba(28,41,33,0.18)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-[#68766a]">Local board</p>
              <h2 className="mt-1 text-lg font-semibold">
                {isAuthenticated ? 'Save this board?' : 'Login to save'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#cbd9cb] bg-white text-[#314039] hover:bg-[#edf5ef]"
              aria-label="Close"
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isAuthenticated ? (
            <div className="space-y-3">
              <p className="text-sm leading-6 text-[#4c5d52]">
                Create a saved document from the current local canvas. The local board stays intact
                if you cancel or the save fails.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isSaving}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#173f35] bg-white px-3 text-sm font-semibold text-[#173f35] hover:bg-[#edf5ef] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  Stay local
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmSave()}
                  disabled={isSaving}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#173f35] px-3 text-sm font-semibold text-white hover:bg-[#0f2d26] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Save
                </button>
              </div>
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
