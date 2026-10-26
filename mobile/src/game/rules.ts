// Client copies of server limits, used only to explain disabled buttons and size inputs. The server enforces them.
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const MAX_NAME_LENGTH = 20;
export const MAX_CLUE_LENGTH = 30;
export const MAX_GUESS_LENGTH = 40;
export const ROOM_CODE_LENGTH = 5;

export const SETTINGS_LIMITS = {
  imposterCount: { min: 1, max: 5, step: 1 },
  rounds: { min: 1, max: 10, step: 1 },
  turnSeconds: { min: 10, max: 60, step: 5 },
  discussionSeconds: { min: 30, max: 300, step: 15 },
  clueRounds: { min: 1, max: 5, step: 1 },
} as const;

export const maxImposters = (players: number) => Math.max(1, Math.floor((players - 1) / 2));

// Phase lengths the server uses (engine/Model.kt), so timer rings know how full to start.
export const REVEAL_SECONDS = 30;
export const VOTE_SECONDS = 30;
export const REVOTE_SECONDS = 20;
export const GUESS_SECONDS = 30;
