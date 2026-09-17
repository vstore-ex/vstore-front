# Container verification and backend handoff

Related issue: https://github.com/vstore-ex/vstore-front/issues/16

The existing multi-stage Dockerfile builds Vite and serves it with non-root nginx
on container port 8080. Keep that port; publish it on host port 3000 (or 80).

## Backend/deployment verification

Docker is not required on the frontend developer's PC. Run these commands on
the backend/deployment machine from the checked-out PR branch:

```sh
docker build -t frontend-app:test .
docker run --rm -d --name vstore-front -p 3000:8080 frontend-app:test
docker inspect --format='{{.State.Health.Status}}' vstore-front
```

Open http://localhost:3000 and http://localhost:3000/healthz.
The latter must return HTTP 200 and healthy. Wait for Docker health to become
healthy. Stop the manual container with docker stop vstore-front.

For automated verification, Node 22+ and Docker are sufficient; npm install is
not required on the host:

```sh
node --test tests/container.test.mjs
```

Or use npm run test:container. The test builds an isolated image, starts a
container WITHOUT a backend on a free loopback port, checks Docker health,
HTML, JS/CSS, deep-link fallback, cache headers, missing assets and hidden-file
protection, then removes the container and its test image. CI runs it on PRs.

## API integration

The default browser API path is /api/v1, proxied to backend:8000. For working
login, attach frontend and backend to the same user-defined Docker network
and give the API service the backend network alias. Docker DNS resolves the
upstream on requests, so an unavailable backend does not prevent static
frontend startup. API calls still fail until the backend is reachable.

The compatibility rewrites for /api/v1/me and /api/v1/admin/users are retained.
Verify registration/login and these routes against the actual backend after
deployment; the standalone smoke test does not verify authentication.

VITE_API_BASE_URL is embedded at build time, not changed by docker run -e.
The current CSP allows same-origin API calls. Prefer /api/v1; an external API
also requires an intentional CSP connect-src change, backend CORS and HTTPS
when the frontend uses HTTPS. Never pass secrets as VITE_ variables.

This PR does not include the separate local JSON catalog/auth changes.
Deploy those in their own PR when ready; containerization alone does not
switch the current main branch to JSON.

## Acceptance and ownership

Frontend supplies container configuration, smoke test and documentation.
Backend/deployment runs Docker and verifies the deployed frontend plus API.
Return the tested commit SHA, test output, health status and deployed URL.
Merge after successful checks; only then close issue #16. Do not treat a
successful Vite build alone as proof of a working container.
