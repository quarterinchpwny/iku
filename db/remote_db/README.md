```txt
npm install
npm run dev
```

The worker is configured to use OSRM via:

```txt
ROUTING_PROVIDER=osrm
OSRM_BASE_URL=https://osrm.quarterinchpwny.online
```

If you deploy to another environment, keep those vars aligned with the reachable OSRM endpoint.

```txt
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
