# TraceRoot

TraceRoot is a bug investigation and root-cause analysis workspace with a React frontend and FastAPI backend.

## Run & Operate

- `pnpm --filter @workspace/traceroot run dev` — run the React frontend
- `pnpm --filter @workspace/api-server run dev` — run the FastAPI backend on port 8080 (`/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Python dependencies are declared in the root `pyproject.toml` and `uv.lock`.
- Issue data is held in memory and resets when the API process restarts. PostgreSQL is intentionally not connected yet.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9, Python 3.13
- Frontend: React + Vite
- API: FastAPI + Pydantic
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- No database is configured in the first build.

## Where things live

- `artifacts/traceroot/` — React app
- `artifacts/api-server/` — FastAPI app, issue models, and in-memory store
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/api-client-react/` and `lib/api-zod/` — generated API client, hooks, and schemas

## Architecture decisions

- FastAPI serves under `/api` so it uses the existing API service route.
- The frontend uses generated React Query hooks from the OpenAPI contract.
- The in-memory store is temporary and must be replaced when PostgreSQL is introduced.

## Product

- Track issues by status, severity, service, environment, and assignee.
- Review dashboard counts and recent investigation activity.
- Create, update, search, filter, and delete issues.

## User preferences

- Add PostgreSQL later; do not provision or wire it into this initial setup.

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, run codegen before changing frontend API usage.
- The API proxy retains `/api` in the path; FastAPI routes include that prefix.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
