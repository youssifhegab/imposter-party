import { create } from 'zustand';

import type { ErrorCode, FinalResult, PublicPlayer, RoomState, RoundResult } from '@/protocol/types';

export type Connection = 'idle' | 'connecting' | 'open' | 'reconnecting';

/** Why this phone is no longer in the room. Reconnecting will not help. */
export type EndReason = 'kicked' | 'room_not_found' | 'invalid_token';

type RoomStore = {
  /** The latest public snapshot from the server. The UI renders from this alone. */
  state: RoomState | null;
  /** serverTime - Date.now() when the snapshot arrived; add to Date.now() to get server time. */
  clockOffset: number;
  /** Every player seen in this room, so results can still name players who have since left. */
  seenPlayers: Record<string, PublicPlayer>;
  roundResult: RoundResult | null;
  finalResult: FinalResult | null;
  /** The server asked this player (a caught imposter) to guess the word. */
  guessPrompted: boolean;
  guessSent: boolean;
  connection: Connection;
  ended: EndReason | null;
  /** The latest rejected action. `at` makes repeated identical errors distinct. */
  error: { code: ErrorCode; at: number } | null;
};

export const initialRoom: RoomStore = {
  state: null,
  clockOffset: 0,
  seenPlayers: {},
  roundResult: null,
  finalResult: null,
  guessPrompted: false,
  guessSent: false,
  connection: 'idle',
  ended: null,
  error: null,
};

export const useRoomStore = create<RoomStore>()(() => initialRoom);
