// GitHub Pages project pages serve from a sub-path (e.g. /whiteboard-fe/),
// while local dev/preview serve from /. import.meta.env.BASE_URL always ends
// with a trailing slash, so prefixing with it keeps every history navigation
// correct in both environments without hardcoding either one.
const BASE_URL = import.meta.env.BASE_URL;

export const GH_PAGES_REDIRECT_KEY = 'gh-pages-redirect';

export function homePath(): string {
  return BASE_URL;
}

export function roomPath(roomId: string): string {
  return `${BASE_URL}?room=${roomId}`;
}

export function dashboardPath(): string {
  return `${BASE_URL}dashboard`;
}

export function isDashboardPath(pathname: string): boolean {
  return pathname === dashboardPath();
}

// GitHub Pages is a static host with no SPA fallback: a hard navigation/
// refresh on /whiteboard-fe/dashboard 404s before any JS runs. public/404.html
// stashes the intended path and bounces back to the app root; this restores
// it before the app reads location for routing.
export function restoreGhPagesRedirect(): void {
  const redirected = sessionStorage.getItem(GH_PAGES_REDIRECT_KEY);
  if (!redirected) return;

  sessionStorage.removeItem(GH_PAGES_REDIRECT_KEY);
  window.history.replaceState({}, '', redirected);
}
