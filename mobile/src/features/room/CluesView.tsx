import { useEffect, useState } from 'react';
import { TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { BounceIn, FadeIn, ZoomIn, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { alpha } from '@/color';
import { Avatar } from '@/components/Avatar';
import { Button, buttonRowStyle } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { T } from '@/components/T';
import { TimerRing } from '@/components/TimerRing';
import { haptics } from '@/feedback/haptics';
import { play } from '@/feedback/sounds';
import { useInputStyle } from '@/features/home/useInputStyle';
import { MAX_CLUE_LENGTH } from '@/game/rules';
import { useGame } from '@/game/useGame';
import { useLoop } from '@/hooks/useLoop';
import { send } from '@/net/gameSocket';
import type { PublicPlayer } from '@/protocol/types';
import { createStyles, phaseThemes, space, useColors } from '@/theme';

import { ClueLog } from './ClueLog';
import { RoomScreen } from './RoomScreen';
import { SecretChip } from './SecretChip';

const CLUES = phaseThemes.CLUES;

export function CluesView() {
  const { state, myId } = useGame();
  const round = state.round!;
  const myTurn = round.currentPlayerId === myId;

  // Medium haptic and a chime the moment your turn starts.
  useEffect(() => {
    if (!myTurn) return;
    haptics.turn();
    play('turn');
  }, [myTurn, round.clues.length]);

  // Keyed by the clue count, so each turn starts fresh (empty input, entrance animation).
  return myTurn ? <MyTurn key={round.clues.length} /> : <TheirTurn />;
}

function TheirTurn() {
  const { t } = useTranslation();
  const { state, player } = useGame();
  const round = state.round!;
  const current = round.currentPlayerId ? player(round.currentPlayerId) : undefined;

  return (
    <RoomScreen>
      <SecretChip />
      <ClueRoundLabel />
      <AvatarRing />
      <Animated.View key={current?.id} entering={FadeIn}>
        <T variant="title" center>
          {t('clues.theirTurn', { name: current?.name ?? '?' })}
        </T>
        <T variant="muted" center>
          {t('clues.listen')}
        </T>
      </Animated.View>
      <ClueLog />
    </RoomScreen>
  );
}

/** The whole screen goes blue: it's your turn. */
function MyTurn() {
  const { t } = useTranslation();
  const styles = useStyles();
  const input = useInputStyle({ size: 22 });
  const { state } = useGame();
  const [clue, setClue] = useState('');
  const trimmed = clue.trim();
  const submit = () => trimmed && send({ type: 'submit_clue', payload: { text: trimmed } });

  return (
    <RoomScreen
      flood
      accent={CLUES.color}
      footer={
        <>
          <TextInput
            value={clue}
            onChangeText={setClue}
            maxLength={MAX_CLUE_LENGTH}
            placeholder={t('clues.placeholder')}
            placeholderTextColor="#FFFFFF99"
            style={[input, styles.input]}
            returnKeyType="send"
            onSubmitEditing={submit}
          />
          <View style={buttonRowStyle.row}>
            <View style={buttonRowStyle.cell}>
              <Button label={t('clues.done')} variant="secondary" onPress={() => send({ type: 'end_turn', payload: {} })} />
            </View>
            <View style={buttonRowStyle.cell}>
              <Button label={t('clues.submit')} color="#FFFFFF" textColor={CLUES.color} disabled={!trimmed} onPress={submit} />
            </View>
          </View>
        </>
      }
    >
      <SecretChip />
      <ClueRoundLabel color="#FFFFFF" />
      <Animated.View entering={BounceIn.duration(700)}>
        <T variant="display" center color="#FFFFFF">
          {t('clues.yourTurn')}
        </T>
      </Animated.View>
      <TimerRing endsAt={state.endsAt} totalSeconds={state.settings.turnSeconds} color="#FFFFFF" textColor="#FFFFFF" size={190} />
      <T variant="heading" center color="#FFFFFF">
        {t('clues.sayClue')}
      </T>
    </RoomScreen>
  );
}

/** "Clue round 2 of 3", only when the host set more than one. */
function ClueRoundLabel({ color }: { color?: string }) {
  const { t } = useTranslation();
  const { state } = useGame();
  const round = state.round!;
  if (round.clueRounds <= 1) return null;
  return (
    <Animated.View key={round.clueRound} entering={BounceIn.duration(600)}>
      <T variant="heading" center color={color ?? CLUES.color}>
        {t('clues.clueRound', { number: round.clueRound, total: round.clueRounds })}
      </T>
    </Animated.View>
  );
}

/** Everyone in turn order around a circle, the current player spotlighted and the turn timer in the middle. */
function AvatarRing() {
  const { state, player } = useGame();
  const { width } = useWindowDimensions();
  const styles = useStyles();
  const round = state.round!;
  const players = round.turnOrder.map(player).filter((p): p is PublicPlayer => p !== undefined);
  const size = Math.min(width - space.md * 2, 340);
  const avatar = players.length > 8 ? 48 : 58;
  const radiusPx = size / 2 - avatar / 2 - 12;
  // Only this clue round's turns get a check or a cross.
  const thisRound = round.clues.slice((round.clueRound - 1) * round.turnOrder.length);
  const done = new Map(thisRound.map((c) => [c.playerId, c.skipped]));

  return (
    // Positions are absolute left/top from trigonometry, so the ring is the same in both directions.
    <View style={[styles.ring, { width: size, height: size }]}>
      <View style={styles.center}>
        <TimerRing endsAt={state.endsAt} totalSeconds={state.settings.turnSeconds} color={CLUES.color} size={size * 0.38} />
      </View>
      {players.map((p, i) => {
        const angle = (i / players.length) * 2 * Math.PI - Math.PI / 2;
        return (
          <RingSeat
            key={p.id}
            player={p}
            size={avatar}
            left={size / 2 + radiusPx * Math.cos(angle) - avatar / 2}
            top={size / 2 + radiusPx * Math.sin(angle) - avatar / 2}
            current={p.id === round.currentPlayerId}
            skipped={done.get(p.id)}
            delay={i * 60}
          />
        );
      })}
    </View>
  );
}

type SeatProps = {
  player: PublicPlayer;
  size: number;
  left: number;
  top: number;
  current: boolean;
  /** undefined: not yet; false: gave a clue; true: timed out. */
  skipped: boolean | undefined;
  delay: number;
};

function RingSeat({ player, size, left, top, current, skipped, delay }: SeatProps) {
  const c = useColors();
  const styles = useStyles();
  const glow = useLoop({ duration: 700, enabled: current });
  const scale = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(current ? 1.3 : skipped === undefined ? 1 : 0.85, { damping: 10 }) }],
  }));
  const halo = useAnimatedStyle(() => ({ opacity: current ? 0.35 + glow.value * 0.5 : 0, transform: [{ scale: 1 + glow.value * 0.25 }] }));

  return (
    <Animated.View entering={ZoomIn.delay(delay).springify()} style={[styles.seat, { left, top, width: size, height: size }]}>
      <Animated.View
        style={[styles.halo, { width: size + 20, height: size + 20, borderRadius: size, backgroundColor: alpha(CLUES.color, 1) }, halo]}
      />
      <Animated.View style={scale}>
        <Avatar avatar={player.avatar} size={size} dimmed={!player.connected} ringColor={current ? '#FFFFFF' : undefined} />
        {skipped !== undefined ? (
          <View style={[styles.mark, { backgroundColor: skipped ? c.faint : c.success }]}>
            <Icon name={skipped ? 'close' : 'check'} size={12} color="#FFFFFF" strokeWidth={3.5} />
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = createStyles((c) => ({
  input: { backgroundColor: '#FFFFFF26', color: '#FFFFFF', borderColor: '#FFFFFF66' },
  ring: { alignSelf: 'center' },
  center: { ...{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }, alignItems: 'center', justifyContent: 'center' },
  seat: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  mark: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
