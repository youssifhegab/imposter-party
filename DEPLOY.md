# Deploying

The setup: the server on **Fly.io** (Docker, Frankfurt), the database on **Neon** (free Postgres, Frankfurt), the
Android app as an **APK** built by **EAS**, and iPhones through **Expo Go**.

Live server: https://imposter-party.fly.dev (health check: `/api/health`).

The server machine sleeps when nobody is connected. The first request after that waits about 10 seconds while it
wakes. During a game it stays awake, because every phone keeps a socket open.

## 1. Database (Neon)

1. Sign up at https://neon.tech and create a project in the region **AWS Europe Central 1 (Frankfurt)**, next to
   the Fly server. Only the Postgres service is needed.
2. Open **Connect**, turn **off** connection pooling, and pick **Java**. Split what it shows into three values:
   - `DB_URL`: `jdbc:postgresql://ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`. Keep only
     `?sslmode=require` after `/neondb`, and no `-pooler` in the host.
   - `DB_USER`: `neondb_owner`
   - `DB_PASSWORD`: the password

The server creates the tables and loads the words itself on start (Flyway), so there's nothing else to do.

## 2. Server (Fly.io)

The config is in `server/fly.toml`: one machine (each party lives in the server's memory, so there must only ever
be one), 512 MB, Frankfurt, port 8090, sleeping when idle.

First time only, with the Fly CLI (`brew install flyctl`, then `fly auth login`):

```sh
cd server
fly apps create imposter-party      # skip if the app exists already
fly secrets set DB_URL='jdbc:postgresql://…/neondb?sslmode=require' DB_USER=neondb_owner DB_PASSWORD='…' \
  SERVER_FORWARD_HEADERS_STRATEGY=native
fly ips allocate-v6 && fly ips allocate-v4 --shared   # the public address; both are free
```

To deploy (after every server change):

```sh
cd server && fly deploy --ha=false
```

`--ha=false` keeps it to one machine. Useful commands: `fly logs`, `fly status`, `fly secrets list`.

If the app ever moves to another address, put it in `mobile/app.json` under `expo.extra.productionApiUrl`.

## 3. Android app (EAS Build → APK)

```sh
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init          # links the project to your Expo account (adds a projectId to app.json)
npx eas-cli@latest build --platform android --profile preview
```

The build runs in Expo's cloud (free plan, may queue for a while) and ends with a link and QR code. Anyone can
open it on Android and install the APK (allow "install unknown apps" when asked).

## 4. iPhones (Expo Go)

TestFlight and the App Store need Apple's paid developer account, so iPhones use Expo Go for now: the app's
JavaScript is published to Expo, and Expo Go opens it from a link, without your Mac running.

## 5. Website (EAS Hosting)

The same app as a website, for iPhones without Expo Go: open it in Safari, then **Share → Add to Home Screen** for
an icon that opens full-screen. `mobile/public/` holds the page's home-screen icon and settings.

Live: https://youssifhegab-imposter.expo.app. To deploy (after every app change):

```sh
cd mobile && npm run deploy:web
```

A new APK is only needed for native changes (icon, new native libraries). Code changes reach installed APKs with
`npm run update:apk`.

## Automatic deploys (GitHub Actions)

Pushing to `main` deploys by itself, so the manual commands above are only needed as a fallback:

- `server/` changed → `.github/workflows/server.yml` runs the tests, then `fly deploy`.
- `mobile/` changed → `.github/workflows/mobile.yml` typechecks and lints, then deploys the website, publishes the
  Expo Go update and the APK update, and starts a new APK build if something native changed (`app.json`, icons,
  dependencies). To build an APK by hand: GitHub → **Actions** → **Mobile** → **Run workflow** → tick
  **Build a new APK**.

Progress and errors show in the repo's **Actions** tab.

**Adding a library with native code?** Also raise `expo.version` in `mobile/app.json` (e.g. `1.0.0` → `1.1.0`).
Installed APKs only take updates made for their own version, so they won't receive code that needs the new
library and crash. Friends then install the new APK to get updates again.

First time only, add two secrets on GitHub: the repo → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**:

- `FLY_API_TOKEN`: run `fly tokens create deploy -a imposter-party` and paste what it prints.
- `EXPO_TOKEN`: on expo.dev, **Account settings** → **Access tokens** → **Create token**.

## Checking the deployed server from your phone during development

`EXPO_PUBLIC_API_URL=https://imposter-party.fly.dev npx expo start` runs the app from your Mac but talks to the
deployed server.
