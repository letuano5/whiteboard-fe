import { getAuthAccessToken } from './access-token';

export function createAuthenticatedHeaders(headers?: HeadersInit): Headers {
  const nextHeaders = new Headers(headers);
  const accessToken = getAuthAccessToken();

  if (accessToken) {
    nextHeaders.set('Authorization', `Bearer ${accessToken}`);
  }

  return nextHeaders;
}

export function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: createAuthenticatedHeaders(init.headers),
  });
}
