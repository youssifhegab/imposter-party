import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { T } from '@/components/T';
import { buildPreview, ME } from '@/dev/fixtures';
import { PhaseView } from '@/features/room/PhaseView';
import type { Phase } from '@/protocol/types';
import { usePrefs } from '@/state/prefs';
import { useRoleStore } from '@/state/role';
import { initialRoom, useRoomStore } from '@/state/room';
import { useSession } from '@/state/session';

const PHASES: Phase[] = ['LOBBY', 'REVEAL', 'CLUES', 'DISCUSSION', 'VOTING', 'REVOTE', 'GUESS', 'RESULTS', 'FINAL'];

/**
 * Development only: shows any game screen with sample data, without a server game, e.g.
 * /dev?phase=VOTING&lang=ar&theme=light&imposter=1. Used for screenshots of every screen.
 */
export default function DevPreview() {
  const params = useLocalSearchParams<Record<string, string>>();
  const phase = params.phase as Phase | undefined;
  const lang = params.lang === 'ar' ? 'ar' : 'en';
  const flag = (name: string) => params[name] === '1';
  const ready = useRoomStore((s) => s.state !== null && s.state.phase === phase);

  useEffect(() => {
    const prefs = usePrefs.getState();
    prefs.setLanguage(lang);
    prefs.setTheme(params.theme === 'light' ? 'light' : 'dark');
    prefs.setMuted(true);
    if (!phase) return;
    const preview = buildPreview({
      phase,
      lang,
      imposter: flag('imposter'),
      admin: params.admin !== '0',
      myTurn: flag('myTurn'),
      voted: flag('voted'),
      prompted: flag('prompted'),
      waiting: flag('waiting'),
    });
    const me = flag('imposter') ? 'p5' : ME;
    useSession.setState({ creds: { roomCode: preview.state.code, playerId: me, playerToken: 'preview' } });
    useRoomStore.setState({
      ...initialRoom,
      state: preview.state,
      seenPlayers: Object.fromEntries(preview.state.players.map((p) => [p.id, p])),
      roundResult: preview.roundResult,
      finalResult: preview.finalResult,
      guessPrompted: preview.guessPrompted,
      connection: 'open',
    });
    useRoleStore.setState({ role: preview.role });
    // Only the URL decides what to show.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  if (!__DEV__) return <Redirect href="/" />;
  if (params.screen === 'home') return <Redirect href="/" />;
  if (params.screen === 'join') return <Redirect href="/join" />;
  if (phase && ready) return <PhaseView />;
  return (
    <Screen>
      <T variant="title">Screen preview</T>
      <View style={{ gap: 8 }}>
        {PHASES.map((p) => (
          <Button key={p} label={p} size="small" variant="secondary" onPress={() => router.setParams({ phase: p })} />
        ))}
      </View>
    </Screen>
  );
}
