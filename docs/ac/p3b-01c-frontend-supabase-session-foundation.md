# P3B-01c Frontend Supabase Session Foundation - Acceptance Criteria

Status: Shipped

AC-1: Frontend config creates a Supabase auth client from `VITE_SUPABASE_PUBLIC_URL` and `VITE_SUPABASE_ANON_KEY`, with browser session persistence and token refresh enabled.
AC-2: A provider adapter exposes login, logout, restore session, refresh session, and auth-state subscription without leaking Supabase SDK details to UI components.
AC-3: A frontend auth store keeps the normalized user/session state, including the current access token, after restore, login, refresh, logout, or provider auth-state changes.
AC-4: The home screen exposes a usable email/password login and logout UI backed by the auth store while preserving the existing create-room flow.
AC-5: This slice does not attach access tokens to Socket.IO or HTTP requests, does not enforce roles, and does not upsert app users in the database.

Delta notes:

- None.
