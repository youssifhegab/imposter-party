import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { AVATARS } from '@/game/avatars';
import type { Credentials } from '@/protocol/types';

export type Profile = { name: string; avatar: number };

/** How many played words a phone remembers. Matches the server's limit. */
export const MAX_RECENT_WORDS = 300;

type SessionStore = {
  profile: Profile;
  /** Word ids this phone played, newest last, across every party. Sent on connect to avoid repeats. */
  recentWordIds: number[];
  /** The room this phone belongs to. Kept across app restarts so the player can rejoin. */
  creds: Credentials | null;
  /** False until the saved values have been read from storage. */
  hydrated: boolean;
  setProfile: (profile: Profile) => void;
  setCreds: (creds: Credentials | null) => void;
  rememberWord: (wordId: number) => void;
};

// `persist` saves the chosen fields to AsyncStorage on every change and loads them back on launch.
export const useSession = create<SessionStore>()(
  persist(
    (set) => ({
      profile: { name: '', avatar: Math.floor(Math.random() * AVATARS.length) },
      creds: null,
      recentWordIds: [],
      hydrated: false,
      setProfile: (profile) => set({ profile }),
      setCreds: (creds) => set({ creds }),
      rememberWord: (wordId) =>
        set(({ recentWordIds }) => ({
          recentWordIds: [...recentWordIds.filter((id) => id !== wordId), wordId].slice(-MAX_RECENT_WORDS),
        })),
    }),
    {
      name: 'imposter-session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ profile, creds, recentWordIds }) => ({ profile, creds, recentWordIds }),
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    },
  ),
);
