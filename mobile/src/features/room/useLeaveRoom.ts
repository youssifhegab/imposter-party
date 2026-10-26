import { router } from 'expo-router';
import { useCallback } from 'react';

import { leave } from '@/net/gameSocket';
import { useSession } from '@/state/session';

/** Leaves the room for good (the seat is freed now), forgets it locally, and goes back home. */
export function useLeaveRoom() {
  const setCreds = useSession((s) => s.setCreds);
  return useCallback(() => {
    leave();
    setCreds(null);
    goHome();
  }, [setCreds]);
}

export function goHome() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
