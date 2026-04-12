# remote_db frontend

Admin dashboard for the Cloudflare Worker in `db/remote_db`.

This dashboard is used to:

- manage queue routes
- inspect commute estimates and heatmaps
- manage incidents, observations, and venue discovery
- support OTA/admin operations exposed by the worker

## Project setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

The built assets are deployed by the worker through Wrangler and served from the `ASSETS` binding.
