# React + Vite

Frontend work is tracked in the [vstore-frontend GitHub Project](https://github.com/orgs/vstore-ex/projects/2). Follow the [Kanban workflow](docs/kanban-workflow.md) when creating or updating issues.

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

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

### Trusted HTTPS proxy

The runtime renders `nginx/default.conf.template` with `EDGE_PROXY_IP`
(default `172.31.240.2`, matching VStore Compose). Set this container environment
variable to the edge's exact address when customizing the proxy network. Only
that TCP peer may supply `X-Forwarded-Proto: http` or `https`; direct requests
and malformed headers use the connection's own scheme. Apply the companion
infrastructure configuration before deploying on a customized proxy network.
