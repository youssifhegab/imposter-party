# Deploying

Free setup: the server on **Render** (free web service, Docker), the database on **Neon** (free Postgres that
doesn't expire), the Android app as an **APK** built by **EAS**, and iPhones through **Expo Go**.

What "free" costs you: Render sleeps the server after 15 minutes with nobody connected, and the first player to
open the app then waits about a minute while it wakes. During a game it stays awake (the app pings every 15s).

## 1. Database (Neon)

1. Sign up at https://neon.tech (GitHub login works) and create a project, e.g. `imposter`, in the region
   closest to your players.
2. On the project dashboard, open **Connect**, pick **Java**, and turn **off** connection pooling.
   You get something like `jdbc:postgresql://ep-cool-name-123.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   plus a user and password. Keep those three values for step 3.

The server creates the tables and loads the words itself on first start (Flyway), so there's nothing else to do.

## 2. Code on GitHub

Render deploys from a Git repository (a private one is fine). From the repo root:

```sh
git add -A && git commit -m "Imposter party game"
git remote add origin https://github.com/<you>/imposter-party.git
git push -u origin main
```

## 3. Server (Render)

1. Sign up at https://render.com with GitHub.
2. **New → Blueprint**, pick the repository. Render reads `render.yaml` and proposes the
   `imposter-party-server` web service on the free plan.
3. Fill in the secrets from step 1: `DB_URL`, `DB_USER`, `DB_PASSWORD`. Apply.
4. The first build takes a few minutes. When it's live, open `https://<your-service>.onrender.com/api/health`;
   it should say `{"status":"ok"}`.
5. If the address isn't `https://imposter-party-server.onrender.com`, put yours in `mobile/app.json` under
   `expo.extra.productionApiUrl`.

Every push to `main` redeploys the server.

## 4. Android app (EAS Build → APK)

```sh
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init          # links the project to your Expo account (adds a projectId to app.json)
npx eas-cli@latest build --platform android --profile preview
```

The build runs in Expo's cloud (free plan, may queue for a while) and ends with a link and QR code. Anyone can
open it on Android and install the APK (allow "install unknown apps" when asked).

## 5. iPhones (Expo Go)

TestFlight and the App Store need Apple's paid developer account, so iPhones use Expo Go for now: the app's
JavaScript is published to Expo, and Expo Go opens it from a link, without your Mac running. See the notes in
the conversation / below once this is set up.

## Checking the deployed server from your phone during development

`EXPO_PUBLIC_API_URL=https://<your-service>.onrender.com npx expo start` runs the app from your Mac but talks to
the deployed server.
