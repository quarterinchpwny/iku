# Iku Project

A location tracking and activity recording application, inspired by Strave and Life360. Built with Nuxt 3 and Capacitor, this project features a robust backend powered by Hono on Cloudflare Workers for Over-the-Air (OTA) updates, user authentication, and real-time data synchronization.

## ✨ Key Features

-   **Live Location Tracking:** Real-time user location tracking on a map using Capacitor/browser Geolocation.
-   **Activity & Route Recording:** Record activities like walks or runs, storing the path, distance, and other metrics.
-   **Historical Route Playback:** Save recorded activities and view them later, displaying the path on the map.
-   **Route Planning:** Plan and visualize routes between two points using the OpenRouteService API.
-   **Offline-First with Cloud Sync:** Leverages a local Dexie.js database for full offline functionality, with seamless data synchronization to a remote Cloudflare D1 database.
-   **Over-the-Air (OTA) Updates:** Allows for seamless application updates without requiring users to download a new version from the app store.
-   **Cross-Platform:** Built with Nuxt 3 for the web and wrapped with Capacitor for native Android capabilities.
-   **Admin Dashboard:** A dedicated Vue.js dashboard to manage OTA updates and application bundles.

## 🚀 Tech Stack

-   **Frontend:**
    -   Framework: [Nuxt 3](https://nuxt.com/)
    -   Mobile Wrapper: [Capacitor](https://capacitorjs.com/)
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
├── pages/                # Main application views and features:
│   │                         # - `index.vue`: The application's landing page.
│   │                         # - `login.vue`, `register.vue`: Authentication related pages.
│   │                         # - `community.vue`, `projects.vue`, `map.vue`: Core feature pages.
│   │                         # - `test.vue`: A page likely used for testing or development.
│   └──
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

## ☁️ Backend (OTA Server)

The backend is a Hono application located in `db/remote_db/`. It's designed to be deployed as a Cloudflare Worker.

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

### Deployment

To build the admin frontend and deploy the worker to Cloudflare:
```bash
npm run db:sync
```
This command chains `db:build` and `db:deploy` to ensure the latest admin panel UI is included in the deployment.

## 🛠️ Utility Scripts

The `_utility_scripts/` directory contains shell scripts to automate common tasks.

-   `npm run apk`: Builds a debug APK.
-   `npm run apk-remote`: Builds a release APK and prepares it for OTA updates.
-   `npm run upload-stable`: Uploads the latest stable build to the OTA server.

Refer to the scripts directly for more details on their functionality.

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.