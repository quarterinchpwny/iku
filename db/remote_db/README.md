# remote_db

Cloudflare Worker backend for IKU. This handles:

- `/api/puv-queue/*` commute endpoints
- OTA update endpoints
- auth and admin APIs
- the admin dashboard assets

## Install

```bash
npm install
npm run dev
```

## Routing configuration

The worker is configured to use OSRM via:

```toml
ROUTING_PROVIDER=osrm
OSRM_BASE_URL=https://osrm-origin.quarterinchpwny.online
```

Use a hostname the Worker can reach directly. In this repo the working setup is a `DNS only` origin host that forwards to the home OSRM proxy.

## Commands

```bash
npm run dev
npm run deploy
npm run migrate
npm run migrate:prod
```

## Type generation

[For generating or syncing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```bash
npm run cf-typegen
```

Pass `CloudflareBindings` as generics when instantiating `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

## Deploy flow

From the repo root:

```bash
npm run db:migrate:prod
npm run db:sync
```

`npm run db:sync` builds the admin frontend in `db/remote_db/frontend` and deploys the worker with Wrangler.
