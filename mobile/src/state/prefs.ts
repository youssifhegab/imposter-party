import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeName = 'dark' | 'light';
/** `system` follows the phone's language. */
export type LanguagePref = 'system' | 'en' | 'ar';

type PrefsStore = {
  theme: ThemeName;
  muted: boolean;
  language: LanguagePref;
  hydrated: boolean;
  setTheme: (theme: ThemeName) => void;
  setMuted: (muted: boolean) => void;
  setLanguage: (language: LanguagePref) => void;
};

/** This phone's app settings. Separate from the session so "leave room" never touches them. */
export const usePrefs = create<PrefsStore>()(
  persist(
    (set) => ({
      // Dark by default: it suits evenings and parties.
      theme: 'dark',
      // Quiet by default: sounds are opt-in, from the speaker button or the app settings.
      muted: true,
      language: 'system',
      hydrated: false,
      setTheme: (theme) => set({ theme }),
      setMuted: (muted) => set({ muted }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'imposter-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      // Version 1 made sound muted by default; phones that saved prefs before start muted once too.
      version: 1,
      migrate: (saved, version) => ({ ...(saved as object), ...(version < 1 ? { muted: true } : {}) }) as PrefsStore,
      partialize: ({ theme, muted, language }) => ({ theme, muted, language }),
      onRehydrateStorage: () => () => usePrefs.setState({ hydrated: true }),
    },
  ),
);
