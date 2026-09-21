# VStore Storefront

[![Frontend CI](https://github.com/vstore-ex/vstore-front/actions/workflows/ci.yml/badge.svg)](https://github.com/vstore-ex/vstore-front/actions/workflows/ci.yml)

Customer storefront for the VStore game store platform. React 19 + Vite, served by unprivileged nginx; API consumed same-origin via `/api/v1`.

## Development

```bash
npm ci
npm run dev      # Vite dev server (proxies /api to the backend)
npm run lint
npm run build
npm run test:e2e
```

## CI/CD

Every PR runs lint, npm audit and the Vite build. Pushes to `main` build the Docker image, scan it with Trivy (blocking gate), push it to GHCR and deploy it to production via the reusable workflows from [vstore-infra](https://github.com/vstore-ex/vstore-infra).
