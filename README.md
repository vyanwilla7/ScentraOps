# ScentraOps

ScentraOps is an internal operations tool for customer-service analysis, complaint tickets, master data, transaction imports, and contribution-profit reporting. It is not an e-commerce storefront: there is no cart, checkout, payment, customer account, marketplace ordering, or automatic customer messaging.

## Architecture

- `frontend/`: independent React/Vite application.
- `backend/`: independent Express API and the only PostgreSQL owner.
- Browser to backend communication uses HTTP JSON APIs and HTTP-only session cookies.
- See [docs/architecture.md](./docs/architecture.md) for boundaries and permissions.

## Prerequisites

- Node.js 18 or newer
- PostgreSQL 14 or newer for persistent mode (local in-memory stores are used by the automated API tests)
- PowerShell on Windows, or equivalent shell commands

## Install and configure

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
Set-Location backend; npm install
Set-Location ../frontend; npm install
```

Keep `.env` files and real credentials out of version control. The frontend only receives the public API URL; PostgreSQL credentials stay in the backend.

## Database and running

With PostgreSQL available and `DATABASE_URL` configured:

```powershell
Set-Location backend
npm run db:migrate
npm run db:seed
npm run dev
```

In another terminal:

```powershell
Set-Location frontend
npm run dev
```

Backend health: `http://localhost:3001/api/v1/health`. API documentation (Swagger UI): `http://localhost:3001/api/v1/docs`; OpenAPI JSON: `http://localhost:3001/api/v1/openapi.json`. Frontend: `http://localhost:5173`.

The API applies the proposal role matrix (Tabel 7) on the server. Menu, tab, and action visibility in the frontend is derived from the permissions returned with the session, but backend authorization remains mandatory.

Local demo accounts are `cs-demo`, `data-demo`, and `owner-demo`, all with password `demo123`. Replace them before any real deployment.

## Tests and builds

```powershell
Set-Location backend; npm test
Set-Location ../frontend; npm run build
```

The backend test suite uses injectable in-memory stores and does not require PostgreSQL. See [docs/test-report.md](./docs/test-report.md) for the latest verified results.

## Contribution profit

Contribution profit is a decision-support metric calculated from complete active transaction lines: net revenue minus product cost, marketplace commission, shipping subsidy, and other recorded variable costs. It is not net business profit because fixed operating costs are not included.

## Import, backup, and restore

DATA users can preview and commit simple comma-separated CSV data through the application. The current parser does not support quoted commas or multipart upload. For PostgreSQL backup and restore:

```powershell
pg_dump "$env:DATABASE_URL" -Fc -f scentraops.backup
pg_restore --clean --if-exists --dbname "$env:DATABASE_URL" scentraops.backup
```

## Limitations and troubleshooting

Read [docs/known-limitations.md](./docs/known-limitations.md). If the API cannot start, verify `PORT`, `DATABASE_URL`, and `CORS_ORIGIN`; PostgreSQL migration failures commonly indicate invalid local credentials. The app can still be tested with the automated in-memory suite.

