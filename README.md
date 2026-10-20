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

The migration is staged: shared logic is covered by #69; screens, components, and CSS
remain for #70. Until that second batch is migrated, the full-source check is expected to
report unformatted files. Use the shared check for the migrated scope. Formatting checks
are local commands and are not added to CI. Imported assets, generated output, dependencies,
coverage, Vite caches, and deployment files are excluded through `.prettierignore`.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
