// Sample rooms for the dev preview route (src/app/dev.tsx). Never used in a real game.
import type { FinalResult, Phase, PublicPlayer, Role, RoomState, RoundResult } from '@/protocol/types';

export type PreviewOptions = {
  phase: Phase;
  lang: 'en' | 'ar';
  imposter: boolean;
  admin: boolean;
  myTurn: boolean;
  voted: boolean;
  prompted: boolean;
  waiting: boolean;
};

export type Preview = {
  state: RoomState;
  role: Role | null;
  roundResult: RoundResult | null;
  finalResult: FinalResult | null;
  guessPrompted: boolean;
};

export const ME = 'p1';
const IMPOSTER = 'p5';

const NAMES = {
  en: ['Sara', 'Omar', 'Lina', 'Karim', 'Mona', 'Adam'],
  ar: ['سارة', 'عمر', 'لينا', 'كريم', 'منى', 'آدم'],
};
const WORD = { en: 'Pizza', ar: 'كشري' };
const CATEGORY = { en: 'Food', ar: 'طعام' };
const CLUES = { en: ['Cheesy', 'Italy', null, 'Round', 'Hot', 'Slice'], ar: ['جبنة', 'إيطاليا', null, 'مدوّر', 'سخن', 'شريحة'] };
const AVATARS = [5, 0, 9, 13, 7, 22];

export function buildPreview(o: PreviewOptions): Preview {
  const now = Date.now();
  const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
  const inLobby = o.phase === 'LOBBY';
  const count = inLobby ? 4 : 6;
  const me = o.imposter ? IMPOSTER : ME;
  const adminId = o.admin ? me : 'p2';

  const players: PublicPlayer[] = ids.slice(0, count).map((id, i) => ({
    id,
    name: NAMES[o.lang][i],
    avatar: AVATARS[i],
    connected: id !== 'p4',
    isAdmin: id === adminId,
    score: [3, 2, 4, 1, 2, 0][i],
    ready: o.phase === 'REVEAL' && i % 2 === 0,
    hasVoted: (o.phase === 'VOTING' || o.phase === 'REVOTE') && (id === me ? o.voted : i < 3),
    waiting: id === me && o.waiting,
  }));

  const turnOrder = ['p3', 'p1', 'p2', 'p4', 'p5', 'p6'];
  const cluesGiven = o.phase === 'CLUES' ? (o.myTurn ? 1 : 3) : 6;
  const endsIn: Partial<Record<Phase, number>> = {
    REVEAL: 22_000,
    CLUES: 17_000,
    DISCUSSION: 84_000,
    VOTING: 19_000,
    REVOTE: 12_000,
    GUESS: 24_000,
  };

  const state: RoomState = {
    code: 'K7MQX',
    phase: o.phase,
    endsAt: endsIn[o.phase] ? now + endsIn[o.phase]! : null,
    serverTime: now,
    adminId,
    settings: {
      category: 'food',
      language: o.lang,
      imposterCount: 1,
      impostersKnowEachOther: false,
      rounds: 3,
      turnSeconds: 30,
      discussionSeconds: 120,
      clueRounds: 2,
    },
    players,
    round: inLobby
      ? null
      : {
          number: o.phase === 'FINAL' ? 3 : 2,
          totalRounds: 3,
          category: 'food',
          turnOrder,
          imposterCount: 1,
          clueRound: 1,
          clueRounds: 2,
          currentPlayerId: o.phase === 'CLUES' ? (o.myTurn ? me : turnOrder[cluesGiven]) : null,
          clues: o.phase === 'REVEAL' ? [] : turnOrder.slice(0, cluesGiven).map((id, i) => ({
            playerId: id,
            text: CLUES[o.lang][i],
            skipped: i === 2,
          })),
          votedCount: o.phase === 'VOTING' ? 3 + (o.voted ? 1 : 0) : 0,
          voterCount: 6,
          revoteCandidates: o.phase === 'REVOTE' ? ['p3', 'p5'] : [],
          revoteSlots: o.phase === 'REVOTE' ? 1 : 0,
          revoteVoterIds: o.phase === 'REVOTE' ? ['p1', 'p2', 'p4', 'p6'] : [],
        },
  };

  const inRound = !inLobby && o.phase !== 'RESULTS' && o.phase !== 'FINAL';
  const role: Role | null = inRound
    ? {
        isImposter: o.imposter,
        category: 'food',
        categoryName: CATEGORY[o.lang],
        word: o.imposter ? null : WORD[o.lang],
        fellowImposterIds: null,
      }
    : null;

  const roundResult: RoundResult | null =
    o.phase === 'RESULTS'
      ? {
          roundNumber: 2,
          wordId: 42,
          votes: { p1: ['p5'], p2: ['p5'], p3: ['p6'], p4: ['p5'], p5: ['p3'], p6: ['p5'] },
          revotes: null,
          caughtIds: [IMPOSTER],
          imposterIds: [IMPOSTER],
          word: WORD[o.lang],
          categoryName: CATEGORY[o.lang],
          guesses: { [IMPOSTER]: { text: o.lang === 'ar' ? 'بيتزا' : 'Pasta', correct: false } },
          points: { p1: 1, p2: 1, p3: 0, p4: 1, p5: 0, p6: 1 },
          scores: { p1: 3, p2: 3, p3: 2, p4: 2, p5: 2, p6: 2 },
          catchStreaks: { p1: 2, p2: 3, p3: 0, p4: 1, p5: 0, p6: 1 },
        }
      : null;

  const finalResult: FinalResult | null =
    o.phase === 'FINAL'
      ? {
          leaderboard: [
            { playerId: 'p3', score: 6, rank: 1 },
            { playerId: 'p1', score: 5, rank: 2 },
            { playerId: 'p2', score: 4, rank: 3 },
            { playerId: 'p5', score: 4, rank: 3 },
            { playerId: 'p6', score: 2, rank: 5 },
            { playerId: 'p4', score: 1, rank: 6 },
          ],
          awards: [
            { type: 'MASTER_OF_DISGUISE', playerIds: ['p3'], value: 2 },
            { type: 'DETECTIVE', playerIds: ['p1', 'p2'], value: 3 },
            { type: 'MOST_SUSPICIOUS', playerIds: ['p6'], value: 5 },
            { type: 'SPEED_DEMON', playerIds: ['p2'], value: 4200 },
          ],
        }
      : null;

  return { state, role, roundResult, finalResult, guessPrompted: o.phase === 'GUESS' && o.prompted };
}
