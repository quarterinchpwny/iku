# IKU

IKU is a commute helper focused on daily travel, queue conditions, and route-aware travel decisions. The app combines live location features, queue prediction, ride-vs-walk guidance, and commute maps in a Nuxt 3 + Capacitor client, backed by a Cloudflare Worker and a self-hosted OSRM stack.

## ✨ Key Features

- **Live Location Tracking:** Real-time user location tracking on a map using Capacitor and browser geolocation.
- **Activity & Route Recording:** Record routes and movement history, storing path and trip context locally before sync.
- **Historical Route Playback:** Review saved route history and display paths on the map later.
- **Route Planning and Commute Guidance:** Plan and visualize routes between two points, compare ride and walking time, and surface commute-focused queue estimates.
- **Offline-First with Cloud Sync:** Uses a local Dexie.js database for offline behavior, with synchronization to a remote Cloudflare D1 database.
- **Over-the-Air (OTA) Updates:** Delivers app updates without a store release, using `@capgo/capacitor-updater` for checksum-verified bundle updates.
- **Cross-Platform:** Built with Nuxt 3 for web delivery and wrapped with Capacitor for Android-native capabilities.
- **Admin Dashboard:** Includes a dashboard for route management, queue prediction inspection, OTA operations, and backend administration.

## What IKU does

- Shows commute estimates for configured queue routes.
- Compares ride time against walking time.
- Returns ride and walking polylines for the map views.
- Tracks passive device movement and syncs it to the backend.
- Supports OTA app delivery through Cloudflare Workers and KV.
- Includes an admin dashboard for queue routes, incidents, observations, venues, and OTA operations.

## Stack

- Frontend: Nuxt 3, Capacitor, Pinia, Leaflet, Tailwind CSS
- Mobile/runtime: Capacitor plugins plus `@capgo/capacitor-updater`
- Public backend: Hono on Cloudflare Workers with D1 and KV
- Routing backend: self-hosted OSRM with separate driving and foot profiles behind one proxy
- Local app storage: Dexie

## Project structure

```txt
/
├── android/                Capacitor Android project
├── assets/                 Global styles, fonts, images
├── components/             Nuxt/Vue UI components
├── composables/            Frontend stateful logic
├── db/
│   ├── osrm/               Self-hosted OSRM stack and prep flow
│   └── remote_db/          Cloudflare Worker backend and admin dashboard
├── layouts/                Nuxt layouts
├── pages/                  Main app pages
├── plugins/                Nuxt plugins
├── server/                 Nuxt server routes
├── stores/                 Pinia stores
├── _utility_scripts/       Build and deployment scripts
└── package.json
```

## Local app setup

### Requirements

- Node.js LTS
- npm
- Android Studio if you build the Capacitor app
- Cloudflare account and Wrangler CLI for the worker
- Docker if you want to run the local OSRM stack

### Install

```bash
git clone <repository-url>
cd iku
npm install
```

### Run the app

```bash
npm run dev
```

### Open Android

```bash
npx cap sync
npx cap open android
```

## Commute API architecture

The main app does not call OSRM directly. The path is:

```txt
pages/composables -> /api/puv-queue/* -> Cloudflare Worker -> OSRM origin host -> local OSRM proxy
```

The live worker is configured for OSRM in [db/remote_db/wrangler.toml](/root/projects/iku/db/remote_db/wrangler.toml):

```toml
[vars]
ROUTING_PROVIDER = "osrm"
OSRM_BASE_URL = "https://osrm-origin.quarterinchpwny.online"
```

The OSRM origin host should be a direct origin hostname, not a Cloudflare-proxied one. In this repo that means:

- `osrm-origin.quarterinchpwny.online` should be `DNS only`
- your reverse proxy should forward that host to the local OSRM proxy port
- the Worker should use that direct origin hostname as `OSRM_BASE_URL`

## OSRM setup

The routing stack lives in [db/osrm/README.md](/root/projects/iku/db/osrm/README.md). The short version is:

1. Copy `db/osrm/.env.example` to `db/osrm/.env`
2. Put the `.osm.pbf` extract in `db/osrm/data/`
3. Run car prep first
4. Run foot prep second
5. Start the runtime stack
6. Expose only the OSRM proxy port through your outer reverse proxy

Verified sequence:

```bash
cd db/osrm
docker compose --env-file .env down
docker compose --env-file .env --profile prep up --force-recreate osrm-customize-car
docker compose --env-file .env --profile prep up --force-recreate osrm-customize-foot
docker compose --env-file .env up -d osrm-routed-car osrm-routed-foot osrm-proxy
```

## Worker setup

The worker lives in [db/remote_db/README.md](/root/projects/iku/db/remote_db/README.md). Common commands:

```bash
npm run db:migrate
npm run db:migrate:prod
npm run db:sync
```

## ⚙️ Tracking Mechanics

### Passive Tracking (Background + Activity Trigger)

- `BackgroundGeolocation` captures updates while the app process is alive.
- Native Android activity recognition runs in the background and triggers location sync on detected activity states.
- Passive JS logging is throttled to every `60s` (`PASSIVE_LOG_INTERVAL`).
- Native activity-triggered sync also uploads passive-compatible samples to `POST /api/location/sync`.

### Upload Semantics (Passive + Activity Trigger)

- Activity-triggered native samples are queued first in local SQLite (`ActivitySyncQueueStore`) and retried with backoff.
- Local JS writes (`routes`, `points`, `passive_locations`) sync through Dexie hooks to `POST /api/location/sync`.
- Backend passive ingest validates and deduplicates samples, then mirrors accepted passive points into `points`.

### Passive Route Grouping

- Passive routes are grouped by UTC day boundary for the commute/history surfaces.
- The app keeps passive movement data separate from explicit active route recording.

### Server-Side Passive Ingest Rules

For `table: passive_locations`, the backend:

- Validates coordinate ranges (`lat`, `lng`)
- Validates timestamp bounds
- Requires a safe `deviceId`
- Verifies `sampleHash` (`SHA-256(deviceId|timestamp|lat6|lng6)`)
- Deduplicates by `sample_hash`
- Assigns or creates `route_id` using the passive grouping rule
- Mirrors accepted passive samples into `points` with the assigned `routeId`

### Active vs Passive Classification

- **Active**: route points created during explicit activity recording (`startActiveRecording` / `activeRouteId`)
- **Passive**: route points created via passive tracking and activity-triggered flow, then tied to passive ingest grouping

## ☁️ Backend (OTA Server)

The backend is a Hono application in `db/remote_db/`. It is deployed as a Cloudflare Worker and also serves the queue/commute APIs.

### OTA Update Flow

1. **Build & bundle:** the upload script builds the Nuxt app and creates a zipped OTA bundle with a checksum.
2. **Upload:** the bundle is uploaded to the Worker, which stores it in KV and records metadata in D1.
3. **Check:** the mobile app calls `/api/ota/check` with its current bundle version.
4. **Update:** if a newer version exists, the app downloads it, verifies the checksum, and applies it through `CapacitorUpdater`.

### Setup

1. Authenticate with Wrangler:
   ```bash
   wrangler login
   ```
2. Create the Cloudflare resources used by `db/remote_db`:
   - one D1 database
   - two KV namespaces: `BUNDLES` and `OTA_MANIFEST`
3. Update `db/remote_db/wrangler.toml` with the correct binding IDs.

### Migrations

```bash
npm run db:migrate
```

For production:

```bash
npm run db:migrate:prod
```

### Admin User Creation

Local:

```bash
cd db/remote_db
npm run db:create-admin -- --username <admin> --password <password>
```

Remote:

```bash
cd db/remote_db
npm run db:create-admin -- --username <admin> --password <password> --remote
```

### Deployment

To build the admin frontend and deploy the worker to Cloudflare:

```bash
npm run db:sync
```

## Utility scripts

- `npm run apk` builds a debug APK
- `npm run upload-apk` builds and pushes an APK flow
- `npm run upload-stable` uploads a stable OTA bundle

## License

MIT
