# Fix Export Page Session Auth Loop

## What & Why
The export data page is stuck in a redirect loop in production: it immediately fires API calls that require a server-side session cookie, gets a 401, forces a logout, sends the teacher to the login page, and after login redirects back to the dashboard (not the export page). The teacher is never able to reach the export page.

Two root causes:
1. Replit's production environment uses a reverse proxy. Without `app.set('trust proxy', 1)`, Express doesn't correctly read the forwarded HTTPS request, so session cookies marked `secure: true` are not reliably established or sent. Changing `cookie.secure` to `"auto"` tells express-session to set the Secure flag only when `req.secure` is true (which works correctly once trust proxy is enabled).
2. The `handle401()` function on the export page immediately calls `logout()` and redirects to `/teacher/login`. After the teacher logs in, they land on the dashboard — not the export page — and the cycle starts again.

## Done looks like
- Teacher logs in, clicks "Export Data", and the export page loads correctly with the preview panel and download button — no redirect loop, no forced logout.
- If the session really does expire mid-session, the export page shows an inline "Session expired" error message with a login link, instead of silently redirecting.
- Everything works both in development and in the deployed production app.

## Out of scope
- Changing session auth on any other endpoint (none of the other endpoints use sessions)
- UI changes to the export page beyond the session-expired error state

## Tasks
1. **Fix trust proxy and cookie.secure in server** — Add `app.set('trust proxy', 1)` immediately after creating the Express app, before the session middleware. Change `cookie.secure` from `process.env.NODE_ENV === "production"` (true/false) to `"auto"` so it respects `req.secure` (which is now correctly set via trust proxy).

2. **Remove redirect loop from export page** — Replace the `handle401()` callback (which calls `logout()` + redirects to `/teacher/login`) with a non-destructive error state: set a React state flag `sessionExpired`, render an inline alert on the page saying "Your session has expired. Please log in again." with a link to `/teacher/login`. Do NOT call `logout()` or redirect automatically — let the teacher choose to log in again.

## Relevant files
- `server/index.ts:1-44`
- `client/src/pages/teacher/export.tsx:60-125`
