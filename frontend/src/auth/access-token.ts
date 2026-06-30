import { useAuthStore } from './auth.store';

export function getAuthAccessToken(): string | null {
  return useAuthStore.getState().session?.accessToken ?? null;
}
