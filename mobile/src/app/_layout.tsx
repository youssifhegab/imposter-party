import i18n, { resolveLanguage, useDirectionStyle, useIsRTL } from '@/i18n';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { FONT_FILES } from '@/fonts';
import { usePrefs } from '@/state/prefs';
import { useColors } from '@/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts(FONT_FILES);
  const hydrated = usePrefs((s) => s.hydrated);
  const language = usePrefs((s) => s.language);
  const c = useColors();
  const rtl = useIsRTL();
  const direction = useDirectionStyle();

  useEffect(() => {
    if (hydrated) i18n.changeLanguage(resolveLanguage(language));
  }, [hydrated, language]);

  useEffect(() => {
    if (Platform.OS === 'web') document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [rtl]);

  if (!fontsLoaded || !hydrated) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  return (
    // The whole layout flips from this one `direction`, instantly and without a reload, so start/end
    // styles become right/left in Arabic. (I18nManager.forceRTL needs an app restart and is ignored by
    // Expo Go.)
    <View style={[{ flex: 1, backgroundColor: c.bg }, direction]}>
      <StatusBar style={c.name === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'fade' }}>
        {/* A swipe back would drop the player out of the game by accident; "Leave" is explicit. */}
        <Stack.Screen name="room" options={{ gestureEnabled: false }} />
      </Stack>
    </View>
  );
}
