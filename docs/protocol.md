# Imposter — Client/Server Protocol

The shared contract between `mobile/` and `server/`. Mirrored by:

- Server: `server/src/main/kotlin/com/imposter/protocol/` (Kotlin sealed classes and payload data classes)
- App: `mobile/src/protocol/types.ts` (TypeScript discriminated unions)

Change this file first, then both mirrors.

## Conventions

- Ids (`playerId`, `adminId`, …) are opaque strings. Room codes are 5 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`; the server accepts them in any case.
- Times (`endsAt`, `serverTime`) are epoch milliseconds from the server clock. Render countdowns as `endsAt - (Date.now() + offset)` where `offset = serverTime - Date.now()` measured when the state arrived.
- `phase` is one of `LOBBY REVEAL CLUES DISCUSSION VOTING REVOTE GUESS RESULTS FINAL`.
- Languages are `"en"` or `"ar"`. Categories are identified by slug (`"food"`), or `"random"` in settings.
- Errors use `{code, message}` with a snake_case `code`. Show a translated string for the code; `message` is for logs.

## REST

REST covers only what happens before a player has a socket.

| Method and path | Body | Success | Errors |
| --- | --- | --- | --- |
| `GET /api/health` | — | `200 {"status":"ok"}` | |
| `GET /api/categories?lang=en` | — | `200 [{id, name, icon, wordCount}]` (`id` is the slug) | `400 invalid_input` |
| `POST /api/rooms` | `{name, avatar, language?}` | `200 {roomCode, playerId, playerToken}` (creator is admin) | `400 invalid_input`, `429 rate_limited` |
| `POST /api/rooms/{code}/join` | `{name, avatar}` | `200 {roomCode, playerId, playerToken}` | `404 room_not_found`, `409 room_full`, `409 name_taken`, `400 invalid_input`, `429 rate_limited` |

- `name`: trimmed, 1–20 characters, unique in the room ignoring case. `avatar`: integer 0–23. `language` defaults to `"en"`.
- Creates and joins are limited to 20 per minute per IP.
- Store `playerToken` and `roomCode`; they are all you need to reconnect.

## WebSocket `/ws`

Every message in both directions is `{"type": string, "payload": object}`. `payload` may be omitted for messages that carry none.

1. Connect, then send `hello`. Until `hello` succeeds, everything except `ping` returns `error not_joined`.
2. After `hello` the server sends `room_state` (and `role`, `guess_prompt`, `round_result`, or `final_result` if the game is at that point).
3. Send `ping` every 15s. A socket silent for 40s is closed by the server.
4. On reconnect, open a new socket and send `hello` again with the same token. A newer socket for the same player closes the older one.
5. A player away for more than 60s loses their seat. Dropping during your own clue turn doesn't end it; the
   turn timer keeps running, so reconnect in time to still give your clue.
6. A dropped player still holds up REVEAL, VOTING, REVOTE and GUESS until they act or the phase timer ends.
   Only a player who has left (seat released) stops counting.

### Client → server

| Type | Payload | Who / when |
| --- | --- | --- |
| `hello` | `{playerToken, roomCode, recentWordIds?}` | First message on every socket. `recentWordIds`: up to 300 word ids this phone played recently (newest last); new rounds avoid words anyone in the room saw while fresh ones are left |
| `update_settings` | Any subset of `Settings` (below) | Admin, LOBBY |
| `kick` | `{playerId}` | Admin, LOBBY, not themselves |
| `start_game` | `{}` | Admin, LOBBY, 3+ players |
| `ready` | `{}` | Players in the game, REVEAL |
| `submit_clue` | `{text}` (1–30 characters after trimming) | Current player, CLUES |
| `end_turn` | `{}` | Current player, CLUES |
| `skip_discussion` | `{}` | Admin, DISCUSSION |
| `vote` | `{targetIds: string[]}` | Players in the game in VOTING; only `round.revoteVoterIds` in REVOTE. Once per phase |
| `guess` | `{text}` (1–40 characters) | A caught imposter who got `guess_prompt`, GUESS, once |
| `next_round` | `{}` | Admin, RESULTS (after the last round this goes to FINAL) |
| `play_again` | `{}` | Admin, FINAL |
| `leave` | `{}` | Anyone; frees the seat now instead of after 60s. Close the socket afterwards |
| `ping` | `{}` | Anyone, any time |

`vote.targetIds` must be distinct, must not include the voter, and must have exactly:

- VOTING: `round.imposterCount` entries, chosen from `round.turnOrder` (minus yourself).
- REVOTE: `round.revoteSlots` entries, chosen from `round.revoteCandidates` (minus yourself). Only players in
  `round.revoteVoterIds` vote: everyone outside the tie, or everyone when all players are tied. Others get
  `error not_allowed`.
- If fewer players than that can be chosen (players left), name all of them.

### Server → client

| Type | Payload | Sent to |
| --- | --- | --- |
| `room_state` | `RoomState` | Everyone, after any change; one player after `hello` |
| `role` | `Role` | That player, at REVEAL and on rejoin during a round |
| `guess_prompt` | `{}` | Each caught imposter, when GUESS starts and on rejoin during it |
| `round_result` | `RoundResult` | Everyone, at RESULTS; one player on rejoin during RESULTS |
| `final_result` | `FinalResult` | Everyone, at FINAL; one player on rejoin during FINAL |
| `kicked` | `{}` | The kicked player, then the socket closes |
| `error` | `{code, message}` | The sender |
| `pong` | `{}` | The sender |

### Payloads

```ts
Settings = {
  category: string            // slug or "random"
  language: "en" | "ar"
  imposterCount: number       // 1–5; start_game also requires <= floor((players - 1) / 2)
  impostersKnowEachOther: boolean
  rounds: number              // 1–10
  turnSeconds: number         // 10–60
  discussionSeconds: number   // 30–300
  clueRounds: number          // 1–5: times the turn order goes around for one word before the discussion
}

RoomState = {
  code: string
  phase: Phase
  endsAt: number | null       // current phase or clue turn deadline
  serverTime: number
  adminId: string
  settings: Settings
  players: Array<{
    id, name, avatar,
    connected: boolean
    isAdmin: boolean
    score: number             // this game
    ready: boolean            // REVEAL
    hasVoted: boolean         // current VOTING or REVOTE ballot
    waiting: boolean          // joined mid-game, plays from the next game
  }>
  round: null | {             // null in LOBBY
    number: number
    totalRounds: number
    category: string          // slug; both crew and imposters know it
    turnOrder: string[]          // the players in this round
    imposterCount: number        // names per VOTING ballot
    clueRound: number            // CLUES: the clue round in progress, from 1
    clueRounds: number           // clue rounds for this word (settings.clueRounds when the round started)
    currentPlayerId: string | null   // CLUES only
    clues: Array<{playerId, text: string | null, skipped: boolean}>   // every turn so far, all clue rounds in order
    votedCount: number
    voterCount: number           // in REVOTE, the number of revote voters
    revoteCandidates: string[]
    revoteSlots: number
    revoteVoterIds: string[]     // REVOTE: who votes (tied players sit out unless everyone is tied)
  }
}

Role = {
  isImposter: boolean
  category: string
  categoryName: string        // in the room's word language
  word: string | null         // null for imposters
  fellowImposterIds: string[] | null   // only when impostersKnowEachOther is on
}

RoundResult = {
  roundNumber: number
  wordId: number              // phones remember it and report it in later hellos
  votes: Record<voterId, targetId[]>
  revotes: Record<voterId, targetId[]> | null   // null when there was no revote
  caughtIds: string[]
  imposterIds: string[]
  word: string
  categoryName: string
  guesses: Record<imposterId, {text, correct: boolean}>
  points: Record<playerId, number>    // this round
  scores: Record<playerId, number>    // totals after this round
  catchStreaks: Record<playerId, number>   // consecutive rounds voting for an imposter, as crew
}

FinalResult = {
  leaderboard: Array<{playerId, score, rank}>   // equal scores share a rank
  awards: Array<{
    type: "MASTER_OF_DISGUISE" | "DETECTIVE" | "MOST_SUSPICIOUS" | "MIND_READER" | "SPEED_DEMON"
    playerIds: string[]       // ties share an award
    value: number             // a count, or average clue ms for SPEED_DEMON
  }>
}
```

`room_state` never contains the word, roles, individual votes, who was caught, or guesses. During voting only `hasVoted` and `votedCount` are public.

### Error codes

| Code | Meaning |
| --- | --- |
| `invalid_message` | Not JSON, unknown `type`, or a payload with missing or mistyped fields |
| `not_joined` | Sent a game message before a successful `hello` |
| `room_not_found` | No room with that code (the socket is closed) |
| `invalid_token` | `hello` token doesn't match a player in the room (the socket is closed) |
| `invalid_input` | A value is out of range or not allowed (bad vote targets, clue too long, unknown setting) |
| `unknown_player` | The player is no longer in the room |
| `not_admin` | Admin-only action |
| `wrong_phase` | Not allowed in the current phase |
| `not_in_game` | The player is waiting for the next game |
| `not_your_turn` | Clue action from someone other than the current player |
| `not_allowed` | E.g. a guess from someone who isn't a caught imposter |
| `already_done` | Second vote or guess in the same phase |
| `not_enough_players` | `start_game` with fewer than 3 players |
| `too_many_imposters` | `start_game` with more imposters than the player count allows |
| `room_full`, `name_taken` | REST join only |
| `no_words` | No words available for the chosen category and language |
| `rate_limited` | Too many creates or joins from this IP |
