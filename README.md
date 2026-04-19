# NGO Church Insights Prototype

Demo-first AWS-oriented prototype for an NGO managing roughly 300 churches across India.

This repo is intentionally standalone from `Movee_19.2`. It is optimized for a polished week-one demo, with local-first development today and a clean path to Cognito, API Gateway, Lambda, DynamoDB, S3, and Amplify deployment later.

## What is included

- Demo login with `super_admin` and `church_leader` roles
- National dashboard with KPIs, filters, India map, and analytics charts
- Church detail page with:
  - church profile edits
  - pastor create/update flow
  - member create/update flow
  - CSV export for the visible member roster
  - AI summary card for the current scope
- Seeded synthetic dataset:
  - 300 churches
  - 300 pastors
  - about 9,000 members
- Backend routes shaped for AWS Lambda/API Gateway deployment
- Local JSON-backed runtime mode plus DynamoDB-ready repository wiring

## Tech stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, TanStack Query, TanStack Table, React Hook Form, Zod, Apache ECharts, React Leaflet
- Backend: Node.js, TypeScript, Hono
- Data: local JSON runtime for development, DynamoDB-ready repository for AWS
- AI: server-side summary generation only

## Repo structure

```text
apps/
  api/          Backend app and Lambda entrypoint
  web/          Frontend app
packages/
  shared/       Shared Zod schemas and TypeScript types
data/
  generated/    Synthetic seed outputs
  runtime/      Local mutable runtime database
docs/           Project notes and future handoff material
```

## Local development

1. Install dependencies:

```bash
npm install --legacy-peer-deps
```

2. Regenerate synthetic seed data if needed:

```bash
npm run generate:seed
```

3. Reset the local runtime database from the generated seed set:

```bash
npm run reset:local-db
```

4. Start the API and web app together:

```bash
npm run dev
```

5. Open the app in the browser:

```text
http://localhost:5173
```

The Vite dev server proxies `/api` requests to the local backend on port `4000`.

## Demo accounts

All demo accounts use the same password:

```text
Demo@12345
```

Prepared identities:

- `admin@ngo.demo` - Super Admin
- `leader.delhi@ngo.demo` - Church Leader
- `leader.mumbai@ngo.demo` - Church Leader
- `leader.bengaluru@ngo.demo` - Church Leader

## Useful commands

```bash
npm run lint
npm run build
npm run dev:web
npm run dev:api
npm run generate:seed
npm run reset:local-db
```

## Key backend routes

- `GET /health`
- `GET /me`
- `GET /dashboard/overview`
- `GET /churches`
- `GET /churches/:churchId`
- `POST /churches`
- `PUT /churches/:churchId`
- `GET /churches/:churchId/pastors`
- `POST /churches/:churchId/pastors`
- `PUT /pastors/:pastorId`
- `GET /churches/:churchId/members`
- `POST /churches/:churchId/members`
- `PUT /members/:memberId`
- `POST /insights/summary`

## AI summary guardrails

- The AI flow is summary-only, not chat
- The backend sends aggregated dashboard data, not raw names or phone numbers
- If no OpenAI key is configured, the API returns a deterministic fallback summary
- Insight summaries are cached for 24 hours

## Environment setup

Copy the example files and fill in values as needed:

- [apps/api/.env.example](C:\sourcecode\ngo-church-insights\apps\api\.env.example)
- [apps/web/.env.example](C:\sourcecode\ngo-church-insights\apps\web\.env.example)

For local demo mode:

- keep `DATA_SOURCE=local`
- keep `ENABLE_DEMO_AUTH=true`
- leave Cognito values empty until AWS setup starts

For AWS wiring later:

- set `DATA_SOURCE=dynamodb`
- create Cognito user pool and app client
- create DynamoDB tables for churches, pastors, members, and user profiles
- configure S3 for optional summary cache and CSV/seed file workflows
- store `OPENAI_API_KEY` server-side only

## Recommended next steps

1. Wire Cognito hosted login into the web app and Lambda auth path.
2. Provision the DynamoDB tables and switch the backend to `DATA_SOURCE=dynamodb`.
3. Add Amplify Hosting deployment for the frontend.
4. Add a simple AWS console checklist under `docs/` once infrastructure setup begins.
