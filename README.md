# VStore frontend

React storefront for the VStore API: catalog, game pages, news, reviews, friends,
profiles, library, cart, wishlist, and wallet. Application data comes from the backend;
the development server does not supply a mock catalog.

Frontend work is tracked in the [vstore-frontend GitHub Project](https://github.com/orgs/vstore-ex/projects/2). Follow the [Kanban workflow](docs/kanban-workflow.md) when creating or updating issues.

## Run locally

You need Git, Node.js 22.12+ (or a supported newer LTS), npm, and a running VStore API.

### 1. Start the backend

Follow the [backend Quick Start](https://github.com/vstore-ex/vstore#quick-start)
in a separate checkout. It covers the Python environment, dependencies (including
ffmpeg), backend environment variables, database migrations, optional development
seed data, and starting `uvicorn app.main:app --reload`. Use your local database and
Redis settings from that guide. The frontend does not create or migrate a database.

Uvicorn normally listens on `http://localhost:8000`; the existing local Docker setup
exposes the API on port `8080`. Check the port used by your running backend:

- Open `http://localhost:8000/health` (or port `8080`). A working database produces
  HTTP 200 with `{"status":"healthy","database":"connected"}`; HTTP 503 reports an
  unavailable database. This endpoint is at `/health`, outside `/api/v1`.
- Open `http://localhost:8000/docs` for the current API contracts.

### 2. Install the frontend

```sh
git clone https://github.com/vstore-ex/vstore-front.git
cd vstore-front
npm ci
```

Create `.env.local` from `.env.example` if you do not already have local settings:

```powershell
# PowerShell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

```sh
# Bash / zsh
test -f .env.local || cp .env.example .env.local
```

For a directly running backend, set this value in `.env.local` (use port `8080`
instead if that is where your backend is exposed):

```dotenv
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Then start the frontend:

```sh
npm run dev
```

Open `http://localhost:5173` (or the URL printed by Vite). For the direct API setup,
use `localhost` consistently for the frontend and backend. The backend allows
`http://localhost:5173`; another frontend origin must be allowed by its CORS settings
and `FRONTEND_URL`. Direct API requests include credentials for authentication.

### API configuration and the local proxy

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Browser API prefix, read by `src/api/client.js`. Defaults to `/api/v1`. Set it in `.env.local` for development or in the build environment for deployment. An absolute backend URL also resolves relative backend media URLs against that host. |
| `VITE_API_PROXY_TARGET` | Backend origin used by the existing Vite proxy for `/api/v1` requests. Defaults to `http://localhost:8080`; omit the `/api/v1` suffix. |

If you keep `VITE_API_BASE_URL=/api/v1`, requests go through the Vite proxy. To point
that proxy at a Uvicorn backend on port 8000, set the variable in the **shell that
starts Vite**:

```powershell
$env:VITE_API_PROXY_TARGET = 'http://localhost:8000'
npm run dev
```

```sh
VITE_API_PROXY_TARGET=http://localhost:8000 npm run dev
```

The current Vite config reads this proxy target from `process.env`; copying its
value into `.env.local` alone does not configure the proxy. The proxy covers only
`/api/v1`, so use the direct API URL above when local uploads are returned as relative
paths such as `/media/...` on the backend host.

Restart Vite after changing local environment settings. `VITE_*` values are public
browser configuration; backend credentials belong in the backend environment.

## Build and preview

```sh
npm run build
npm run preview
```

The build is written to `dist/`; preview normally serves it at `http://localhost:4173`.
`VITE_API_BASE_URL` is embedded at build time, so changing it requires rebuilding.
For the existing same-origin deployment, use `/api/v1`. Preview is a local build
check, not the production server.

Preview inherits the same `/api/v1` proxy and shell `VITE_API_PROXY_TARGET` setting.
If the build uses an absolute backend URL instead, the backend must allow the
preview origin (`http://localhost:4173`) for authenticated requests.

Before submitting changes, run `npm test`, `npm run lint`, `npm run format:check`,
and `npm run build` locally. A bundle-size advisory may be printed by the build;
check its exit status to distinguish an advisory from a failed build.

### Connection troubleshooting

- `ECONNREFUSED` / failed API requests: check the backend health URL and whether
  the chosen API port is 8000 or 8080. For the proxy, check the shell variable above.
- CORS errors with an absolute API URL: check the frontend origin allowed by the
  backend, especially if Vite selected a different port.
- Sign-in works but the session is lost: inspect API responses and the backend's
  cookie settings for your local HTTP/HTTPS setup; use the same hostname consistently.
- Empty catalog: verify the backend contains published games. Loading, error, and
  empty states are intentional; the app does not substitute local product arrays.

## Source formatting

Install the locked development tools with `npm ci`. Prettier uses two spaces, single quotes,
no optional semicolons, trailing commas, a 100-column target, and LF line endings. These
settings follow the existing JavaScript conventions; the separate source plan referenced
in #68 was not attached to the issue, so equivalence to that plan has not been verified.
ESLint continues to check code quality, with conflicting formatting rules disabled.

- `npm run format` / `npm run format:check`: format or inspect all JS, JSX, CSS, and JSON in `src`.
- `npm run format:shared` / `npm run format:check:shared`: format or inspect the API, auth,
  cart, data, hooks, orders, utilities, and wishlist modules (including state providers).
- To format a single file, use `npm exec -- prettier --write src/api/client.js`.

Shared logic (#69) and the remaining screens, components, and CSS (#70) now follow the
same formatting rules. Run `npm run format:check` to verify all source files before
submitting changes. Formatting checks remain local commands; the CI enforcement
acceptance criteria in #70 are still pending. Imported assets, generated output,
dependencies, coverage, Vite caches, and deployment files are excluded through
`.prettierignore`.

## Local unit and component tests

Use Node.js 22.12+ (or a supported newer LTS) and install dependencies with `npm ci`.
Tests run headlessly with Vitest, jsdom, and React Testing Library; no backend,
database, or Vite development server is needed.

- `npm test`: run the unit/component suite once.
- `npm run test:watch`: rerun affected tests while editing.
- `npm run test:coverage`: run with text, HTML, and LCOV coverage reports in `coverage/`.
- `npm test -- tests/api/client.test.js`: run a specific suite.

The API tests cover authentication headers, refresh/error handling, cart contracts,
currency formatting, and review validation. Shopping tests exercise the real state
providers, header, cart/checkout, and wishlist components with isolated API responses.
Fixtures and request mocks live only under `tests/`; unexpected fetch calls fail tests.
The dialog shim checks visibility and state, not native focus trapping or browser layout.
Coverage is scoped to the modules under test and is not a whole-application coverage claim.

`vitest.config.js` is separate from the development/deployment configuration. These
commands are local; CI integration from #65 remains pending. The existing Playwright
`test:e2e` command is unchanged and has its own running-app requirements.
