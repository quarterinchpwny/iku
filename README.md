# Iku Project

A location tracking and activity recording application, inspired by Strave and Life360. Built with Nuxt 3 and Capacitor, this project features a robust backend powered by Hono on Cloudflare Workers for Over-the-Air (OTA) updates, user authentication, and real-time data synchronization.

## ✨ Key Features

-   **Live Location Tracking:** Real-time user location tracking on a map using Capacitor/browser Geolocation.
-   **Activity & Route Recording:** Record activities like walks or runs, storing the path, distance, and other metrics.
-   **Historical Route Playback:** Save recorded activities and view them later, displaying the path on the map.
-   **Route Planning:** Plan and visualize routes between two points using the OpenRouteService API.
-   **Offline-First with Cloud Sync:** Leverages a local Dexie.js database for full offline functionality, with seamless data synchronization to a remote Cloudflare D1 database.
-   **Over-the-Air (OTA) Updates:** Allows for seamless application updates without requiring users to download a new version from the app store. Uses `@capgo/capacitor-updater` for secure, checksum-verified bundle updates.
-   **Cross-Platform:** Built with Nuxt 3 for the web and wrapped with Capacitor for native Android capabilities.
-   **Admin Dashboard:** A dedicated Vue.js dashboard to manage OTA updates, view update history, and manage application bundles.

## 🚀 Tech Stack

-   **Frontend:**
    -   Framework: [Nuxt 3](https://nuxt.com/)
    -   Mobile Wrapper: [Capacitor](https://capacitorjs.com/)
    -   OTA Updates: [@capgo/capacitor-updater](https://capgo.app/)
    -   State Management: [Pinia](https://pinia.vuejs.org/)
    -   Mapping: [Leaflet](https://leafletjs.com/)
    -   Routing Service: [OpenRouteService](https://openrouteservice.org/)
    -   Local Database: [Dexie.js](https://dexie.org/)
    -   Styling: [Tailwind CSS](https://tailwindcss.com/)
    -   UI Components: [Radix Vue](https://www.radix-vue.com/) & [shadcn-nuxt](https://www.shadcn-vue.com/)
-   **Backend (`db/remote_db`):**
    -   Framework: [Hono](https://hono.dev/)
    -   Platform: [Cloudflare Workers](https://workers.cloudflare.com/)
    -   Database: [Cloudflare D1](https://developers.cloudflare.com/d1/)
    -   Storage: [Cloudflare KV](https://developers.cloudflare.com/kv/)
-   **Tooling:**
    -   [Vite](https://vitejs.dev/)
    -   [ESLint](https://eslint.org/) & [Prettier](https://prettier.io/)
    -   [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

## 📂 Project Structure

```
/
├── android/              # Capacitor Android project
├── assets/               # Global styles, fonts, and images
├── components/           # Vue components
├── db/
│   └── remote_db/        # Cloudflare Worker backend (Hono) and admin UI
├── layouts/              # Nuxt layouts
├── pages/                # Main application views and features
├── plugins/              # Nuxt plugins (Pinia, Dexie)
├── server/               # Nuxt server routes
├── stores/               # Pinia store modules
├── _utility_scripts/     # Build and deployment scripts
├── capacitor.config.ts   # Capacitor configuration
├── nuxt.config.ts        # Nuxt configuration
└── package.json
```

## 🏁 Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (LTS version recommended)
-   `npm` or your preferred package manager
-   [Android Studio](https://developer.android.com/studio) for native Android development.
-   A [Cloudflare account](https://dash.cloudflare.com/sign-up) with Wrangler CLI set up.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd iku
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Development

1.  **Run the Nuxt frontend:**
    This will start the web application in development mode with hot-reloading.
    ```bash
    npm run dev
    ```

2.  **Sync Capacitor dependencies:**
    Whenever you add a new Capacitor plugin or change its configuration, run:
    ```bash
    npx cap sync
    ```

3.  **Run on Android:**
    Open the native Android project in Android Studio to run it on an emulator or a physical device.
    ```bash
    npx cap open android
    ```

## ⚙️ Tracking Mechanics

### Passive Tracking (Background + Heartbeat)

- `BackgroundGeolocation` captures updates while the app process is alive.
- Native Android heartbeat runs through a foreground service for persistence.
- Heartbeat can be triggered by:
  - Scheduled alarm (`HeartbeatScheduler`)
  - Location wake events (`LocationWakeScheduler` + `LocationWakeReceiver`)
  - Manual heartbeat/debug actions
- Passive JS logging is throttled to every `60s` (`PASSIVE_LOG_INTERVAL`).
- Heartbeat fallback interval is started at `60 minutes` in the geolocation store, and scheduler enforces a minimum of `5 minutes`.

### Upload Semantics (Passive Heartbeat)

- Heartbeat samples are **queued first** into local SQLite (`HeartbeatQueueStore`).
- The same run then tries to upload queued payloads to `POST /api/location/sync`.
- Upload is **not continuous streaming**.
- On failure, samples remain queued and are retried with exponential backoff.
- Queue items are pruned by TTL and dead-letter thresholds.

### Passive Route Grouping

- Passive routes are segmented by time gap:
  - If gap between passive points is greater than `30 minutes`, a new route is created.
  - Otherwise points are appended to the existing passive route.
- This `30-minute` rule is implemented both:
  - Locally in the app store (`ensurePassiveRoute`)
  - On backend ingest per `device_id` (`getPassiveRouteId`)

### Server-Side Passive Ingest Rules

For `table: passive_locations`, the backend:

- Validates coordinate ranges (`lat`, `lng`)
- Validates timestamp bounds
- Requires a safe `deviceId`
- Verifies `sampleHash` (`SHA-256(deviceId|timestamp|lat6|lng6)`)
- Deduplicates by `sample_hash`
- Assigns/creates `route_id` using the 30-minute grouping rule
- Mirrors accepted passive samples into `points` with the assigned `routeId`

### Active vs Passive Classification

- **Active**: route points created during explicit activity recording (`startActiveRecording` / `activeRouteId`).
- **Passive**: route points created via passive tracking/heartbeat flow and tied to passive ingest grouping.
- Community/history views can classify route rows using passive route membership (via passive records with `route_id`).

## ☁️ Backend (OTA Server)

The backend is a Hono application located in `db/remote_db/`. It's designed to be deployed as a Cloudflare Worker.

### OTA Update Flow

1.  **Build & Bundle:** The `upload-stable.sh` script uses `@capgo/cli` to build the Nuxt app and create a zipped bundle with a unique checksum.
2.  **Upload:** The bundle is uploaded to the Cloudflare Worker, which stores the file in KV and records the version, URL, and checksum in a manifest and D1 history.
3.  **Check:** When the mobile app starts, it calls `/api/ota/check` with its current bundle version.
4.  **Update:** If a newer version is available, the app downloads the bundle, verifies the checksum, and applies the update using `CapacitorUpdater`.

### Setup

1.  **Authenticate with Wrangler:**
    ```bash
    wrangler login
    ```

2.  **Create D1 Database and KV Namespaces:**
    You will need to create a D1 database and two KV namespaces (`BUNDLES`, `OTA_MANIFEST`) in your Cloudflare dashboard. Then, update your `wrangler.toml` file in `db/remote_db/` with the correct IDs.

### Migrations

To set up the database schema, run the migrations:
```bash
npm run db:migrate
```

### Admin User Creation

You must create an admin user to access the OTA dashboard and upload updates.

1.  **Local Database:**
    ```bash
    cd db/remote_db
    npm run db:create-admin -- --username <admin> --password <password>
    ```

2.  **Production (Remote) Database:**
    ```bash
    cd db/remote_db
    npm run db:create-admin -- --username <admin> --password <password> --remote
    ```

### Deployment

To build the admin frontend and deploy the worker to Cloudflare:
```bash
npm run db:sync
```

## 🛠️ Utility Scripts

The `_utility_scripts/` directory contains shell scripts to automate common tasks.

-   `npm run apk`: Builds a debug APK.
-   `npm run apk-remote`: Builds a release APK and prepares it for OTA updates.
-   `npm run upload-stable`: Uploads the latest stable build to the OTA server.
    -   Usage: `./_utility_scripts/upload-stable.sh <admin_username> <admin_password> [version]`

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
