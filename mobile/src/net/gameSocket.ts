import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

import { WS_URL } from '@/api/config';
import type { ClientMessage, Credentials, ErrorCode, ServerMessage } from '@/protocol/types';
import { useRoleStore } from '@/state/role';
import { type EndReason, initialRoom, useRoomStore } from '@/state/room';
import { useSession } from '@/state/session';

/**
 * The one socket to the game server. It sends `hello` on every (re)connect, pings every 15s, reconnects with
 * backoff when the connection drops, and writes every server message into the stores. Screens never touch
 * the socket directly: they read stores and call `send`.
 */

const PING_MS = 15_000;
const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 10_000;
// After this long in the background the socket may be dead even though it looks open, so check it.
const STALE_AFTER_BACKGROUND_MS = 5_000;
// How long a ping may go unanswered before the socket counts as dead.
const PROBE_TIMEOUT_MS = 3_000;

const FATAL_ERRORS: Partial<Record<ErrorCode, EndReason>> = {
  room_not_found: 'room_not_found',
  invalid_token: 'invalid_token',
};

let creds: Credentials | null = null;
let socket: WebSocket | null = null;
let attempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let pingTimer: ReturnType<typeof setInterval> | undefined;
let appStateSub: NativeEventSubscription | undefined;
let backgroundedAt: number | null = null;
let probeTimer: ReturnType<typeof setTimeout> | undefined;

const setRoom = useRoomStore.setState;

export function connect(next: Credentials) {
  disconnect();
  creds = next;
  setRoom({ connection: 'connecting' });
  appStateSub = AppState.addEventListener('change', onAppState);
  open();
}

/** Closes the socket and forgets the room locally. The seat is held on the server for 60s. */
export function disconnect() {
  creds = null;
  clearTimeout(reconnectTimer);
  clearTimeout(probeTimer);
  clearInterval(pingTimer);
  appStateSub?.remove();
  appStateSub = undefined;
  dropSocket();
  useRoomStore.setState(initialRoom, true);
  useRoleStore.setState({ role: null });
}

/** Tells the server this player is leaving for good, then disconnects. */
export function leave() {
  send({ type: 'leave', payload: {} });
  disconnect();
}

export function send(message: ClientMessage): boolean {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(message));
  return true;
}

function open() {
  if (!creds) return;
  clearTimeout(reconnectTimer);
  dropSocket();
  const { playerToken, roomCode } = creds;
  const ws = new WebSocket(WS_URL);
  socket = ws;

  // Every handler checks `socket === ws` so events from a replaced socket are ignored.
  ws.onopen = () => {
    if (socket !== ws) return;
    attempts = 0;
    // The words this phone played before, so the server can pick ones nobody here has seen.
    const recentWordIds = useSession.getState().recentWordIds;
    send({ type: 'hello', payload: { playerToken, roomCode, recentWordIds } });
    setRoom({ connection: 'open' });
    pingTimer = setInterval(() => send({ type: 'ping', payload: {} }), PING_MS);
  };
  ws.onmessage = (event) => {
    if (socket !== ws) return;
    try {
      handle(JSON.parse(String(event.data)) as ServerMessage);
    } catch {
      // Ignore anything that isn't valid JSON; the server never sends it.
    }
  };
  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    clearInterval(pingTimer);
    if (creds && !useRoomStore.getState().ended) scheduleReconnect();
  };
}

function dropSocket() {
  const old = socket;
  socket = null;
  clearInterval(pingTimer);
  clearTimeout(probeTimer);
  old?.close();
}

function scheduleReconnect() {
  setRoom({ connection: 'reconnecting' });
  const jitter = 0.75 + Math.random() * 0.5;
  const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempts) * jitter;
  attempts += 1;
  reconnectTimer = setTimeout(open, delay);
}

function onAppState(status: AppStateStatus) {
  if (status !== 'active') {
    backgroundedAt ??= Date.now();
    return;
  }
  const away = backgroundedAt === null ? 0 : Date.now() - backgroundedAt;
  backgroundedAt = null;
  if (!creds || useRoomStore.getState().ended) return;
  if (socket?.readyState !== WebSocket.OPEN) {
    reconnectNow();
  } else if (away > STALE_AFTER_BACKGROUND_MS) {
    // Don't replace a socket that still works: closing it makes the server see this player leave for a
    // moment. Ping it, and only start fresh if no pong comes back.
    clearTimeout(probeTimer);
    probeTimer = setTimeout(reconnectNow, PROBE_TIMEOUT_MS);
    send({ type: 'ping', payload: {} });
  }
}

function reconnectNow() {
  attempts = 0;
  setRoom({ connection: 'reconnecting' });
  open();
}

function handle(message: ServerMessage) {
  switch (message.type) {
    case 'room_state': {
      const state = message.payload;
      const seenPlayers = { ...useRoomStore.getState().seenPlayers };
      state.players.forEach((p) => (seenPlayers[p.id] = p));
      const inRound = state.phase !== 'LOBBY' && state.phase !== 'RESULTS' && state.phase !== 'FINAL';
      setRoom({
        state,
        seenPlayers,
        clockOffset: state.serverTime - Date.now(),
        ...(state.phase !== 'GUESS' && { guessPrompted: false, guessSent: false }),
        ...(state.phase === 'LOBBY' && { roundResult: null, finalResult: null }),
      });
      // A role arrives just before the state that starts its round, so only clear it once the round is over.
      if (!inRound) useRoleStore.setState({ role: null });
      break;
    }
    case 'role':
      useRoleStore.setState({ role: message.payload });
      break;
    case 'guess_prompt':
      setRoom({ guessPrompted: true });
      break;
    case 'round_result':
      setRoom({ roundResult: message.payload });
      useSession.getState().rememberWord(message.payload.wordId);
      break;
    case 'final_result':
      setRoom({ finalResult: message.payload });
      break;
    case 'kicked':
      setRoom({ ended: 'kicked' });
      break;
    case 'error': {
      const ended = FATAL_ERRORS[message.payload.code];
      setRoom(ended ? { ended } : { error: { code: message.payload.code, at: Date.now() } });
      break;
    }
    case 'pong':
      clearTimeout(probeTimer);
      break;
  }
}

/** Marks the guess as sent so the input hides while other caught imposters are still guessing. */
export function sendGuess(text: string) {
  if (send({ type: 'guess', payload: { text } })) setRoom({ guessSent: true });
}
