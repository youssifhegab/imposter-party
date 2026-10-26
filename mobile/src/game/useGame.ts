import { useMemo } from 'react';

import type { PublicPlayer, RoomState } from '@/protocol/types';
import { useRoomStore } from '@/state/room';
import { useSession } from '@/state/session';

export type Game = {
  state: RoomState;
  myId: string;
  me: PublicPlayer | undefined;
  isAdmin: boolean;
  /** Looks up any player seen in this room, including ones who have left since. */
  player: (id: string) => PublicPlayer | undefined;
};

/** The room as seen by this phone. Only call it from screens shown once the first snapshot has arrived. */
export function useGame(): Game {
  const state = useRoomStore((s) => s.state);
  const seen = useRoomStore((s) => s.seenPlayers);
  const myId = useSession((s) => s.creds?.playerId);

  return useMemo(() => {
    if (!state || !myId) throw new Error('useGame needs a room snapshot and credentials');
    return {
      state,
      myId,
      me: state.players.find((p) => p.id === myId),
      isAdmin: state.adminId === myId,
      player: (id: string) => state.players.find((p) => p.id === id) ?? seen[id],
    };
  }, [state, seen, myId]);
}
