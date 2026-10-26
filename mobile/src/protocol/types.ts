// Mirrors docs/protocol.md. Change that file first, then this one and the server's protocol package.

export type Phase =
  | 'LOBBY'
  | 'REVEAL'
  | 'CLUES'
  | 'DISCUSSION'
  | 'VOTING'
  | 'REVOTE'
  | 'GUESS'
  | 'RESULTS'
  | 'FINAL';

export type WordLanguage = 'en' | 'ar';

export const RANDOM_CATEGORY = 'random';

export type Settings = {
  category: string;
  language: WordLanguage;
  imposterCount: number;
  impostersKnowEachOther: boolean;
  rounds: number;
  turnSeconds: number;
  discussionSeconds: number;
  /** Times the turn order goes around for one word before the discussion. */
  clueRounds: number;
};

export type PublicPlayer = {
  id: string;
  name: string;
  avatar: number;
  connected: boolean;
  isAdmin: boolean;
  score: number;
  ready: boolean;
  hasVoted: boolean;
  waiting: boolean;
};

export type Clue = { playerId: string; text: string | null; skipped: boolean };

export type PublicRound = {
  number: number;
  totalRounds: number;
  category: string;
  turnOrder: string[];
  imposterCount: number;
  /** The clue round in progress (from 1) and how many there are for this word. */
  clueRound: number;
  clueRounds: number;
  currentPlayerId: string | null;
  clues: Clue[];
  votedCount: number;
  voterCount: number;
  revoteCandidates: string[];
  revoteSlots: number;
  /** REVOTE: who votes. Tied players sit out unless everyone is tied. */
  revoteVoterIds: string[];
};

export type RoomState = {
  code: string;
  phase: Phase;
  endsAt: number | null;
  serverTime: number;
  adminId: string;
  settings: Settings;
  players: PublicPlayer[];
  round: PublicRound | null;
};

export type Role = {
  isImposter: boolean;
  category: string;
  categoryName: string;
  word: string | null;
  fellowImposterIds: string[] | null;
};

export type RoundResult = {
  roundNumber: number;
  /** Remembered on this phone so later parties avoid the word. */
  wordId: number;
  votes: Record<string, string[]>;
  revotes: Record<string, string[]> | null;
  caughtIds: string[];
  imposterIds: string[];
  word: string;
  categoryName: string;
  guesses: Record<string, { text: string; correct: boolean }>;
  points: Record<string, number>;
  scores: Record<string, number>;
  catchStreaks: Record<string, number>;
};

export type AwardType = 'MASTER_OF_DISGUISE' | 'DETECTIVE' | 'MOST_SUSPICIOUS' | 'MIND_READER' | 'SPEED_DEMON';

export type FinalResult = {
  leaderboard: { playerId: string; score: number; rank: number }[];
  awards: { type: AwardType; playerIds: string[]; value: number }[];
};

export type ErrorCode =
  | 'invalid_message'
  | 'not_joined'
  | 'room_not_found'
  | 'invalid_token'
  | 'invalid_input'
  | 'unknown_player'
  | 'not_admin'
  | 'wrong_phase'
  | 'not_in_game'
  | 'not_your_turn'
  | 'not_allowed'
  | 'already_done'
  | 'not_enough_players'
  | 'too_many_imposters'
  | 'room_full'
  | 'name_taken'
  | 'no_words'
  | 'rate_limited';

export type ApiError = { code: ErrorCode; message: string };

type Empty = Record<string, never>;

export type ClientMessage =
  | { type: 'hello'; payload: { playerToken: string; roomCode: string; recentWordIds?: number[] } }
  | { type: 'update_settings'; payload: Partial<Settings> }
  | { type: 'kick'; payload: { playerId: string } }
  | { type: 'start_game'; payload: Empty }
  | { type: 'ready'; payload: Empty }
  | { type: 'submit_clue'; payload: { text: string } }
  | { type: 'end_turn'; payload: Empty }
  | { type: 'skip_discussion'; payload: Empty }
  | { type: 'vote'; payload: { targetIds: string[] } }
  | { type: 'guess'; payload: { text: string } }
  | { type: 'next_round'; payload: Empty }
  | { type: 'play_again'; payload: Empty }
  | { type: 'leave'; payload: Empty }
  | { type: 'ping'; payload: Empty };

export type ServerMessage =
  | { type: 'room_state'; payload: RoomState }
  | { type: 'role'; payload: Role }
  | { type: 'guess_prompt'; payload: Empty }
  | { type: 'round_result'; payload: RoundResult }
  | { type: 'final_result'; payload: FinalResult }
  | { type: 'kicked'; payload: Empty }
  | { type: 'error'; payload: ApiError }
  | { type: 'pong'; payload: Empty };

// REST
export type Category = { id: string; name: string; icon: string; wordCount: number };
export type CreateRoomRequest = { name: string; avatar: number; language?: WordLanguage };
export type JoinRoomRequest = { name: string; avatar: number };
export type Credentials = { roomCode: string; playerId: string; playerToken: string };
