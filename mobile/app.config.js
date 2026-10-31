// Extends app.json. Expo Go only opens a published update whose runtime version is its own SDK
// ("exposdk:58.0.0"), while the APK checks updates against the app version ("1.0.0"). So updates meant for
// Expo Go are published with EXPO_GO_UPDATE=1 (see `npm run update:expo-go`).
module.exports = ({ config }) =>
  process.env.EXPO_GO_UPDATE === '1' ? { ...config, runtimeVersion: 'exposdk:58.0.0' } : config;
