import Constants from 'expo-constants';

const DEV_SERVER_PORT = 8090;

/**
 * Where the game server is:
 * 1. EXPO_PUBLIC_API_URL, if set (e.g. to try a phone against the deployed server from `expo start`).
 * 2. In development, the dev machine's LAN IP that Metro is served from, so a phone on the same Wi-Fi reaches
 *    the local server with no config.
 * 3. In release builds (APK, Expo Go link), `extra.productionApiUrl` from app.json: the deployed HTTPS server.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const production = Constants.expoConfig?.extra?.productionApiUrl as string | undefined;
  if (!__DEV__ && production) return production.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:${DEV_SERVER_PORT}`;
}

export const API_URL = resolveApiUrl();
// https → wss: the deployed server is behind TLS, which iOS and Android release builds require.
export const WS_URL = `${API_URL.replace(/^http/, 'ws')}/ws`;
