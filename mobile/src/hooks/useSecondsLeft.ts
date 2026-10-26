import { useRoomStore } from '@/state/room';

import { useNow } from './useNow';

/** Whole seconds until [endsAt] (server epoch ms), corrected for this phone's clock being off. */
export function useSecondsLeft(endsAt: number | null): number | null {
  const offset = useRoomStore((s) => s.clockOffset);
  const now = useNow();
  if (endsAt === null) return null;
  return Math.max(0, Math.ceil((endsAt - (now + offset)) / 1000));
}
