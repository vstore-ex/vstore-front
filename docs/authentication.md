# Authentication (issue #21)

AuthProvider owns the in-memory user, initialization, refresh and logout state.
The app waits for GET /users/me before rendering account controls. Protected
account, orders, cart and wishlist routes redirect to #/login?next=...; the
allowlisted destination survives reload. Catalog browsing remains public.

The API client sends credentials: include and never consumes token fields or
reads/writes tokens in browser storage. POST /login uses form encoding;
POST /auth/register/ uses JSON. POST /refresh is shared by concurrent 401s,
with one replay per request. A failed refresh or rejected replay ends the
session; login errors do not trigger refresh. Account-banned 403s show a
separate blocked screen. Other 403s remain ordinary authorization errors.

POST /logout and POST /logout-all clear in-memory identity immediately and
broadcast logout to other tabs using BroadcastChannel. In-flight session
restoration cannot overwrite logout. Server logout failures are visible and
retryable. Logout-all first refreshes because this backend only revokes all
refresh tokens when its access cookie is valid. Profile updates and multipart
avatar uploads use the same client; image type is the only client file limit.

Paths verified against vstore feat/ci-ssh-deploy at 6bf01d1. Keep API same-origin
via Vite/nginx to support the backend's SameSite=Lax cookies. No real-account
creation is needed for the automated browser contract suite: npm run test:auth.
The backend currently reports generic user-already-exists errors, so both
username and email are marked when it does not identify the conflicting field.

Backend limitation: logout-all revokes all refresh tokens but blacklists only
the requesting access token; access cookies on other devices can remain valid
until their expiry. Full immediate server-wide access revocation needs a
backend change. Same-origin tabs clear their UI immediately via broadcast.
