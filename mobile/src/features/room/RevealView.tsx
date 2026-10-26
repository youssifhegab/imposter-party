import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ZoomIn,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { CheckBadge } from '@/components/PlayerTile';
import { T } from '@/components/T';
import { TimerRing } from '@/components/TimerRing';
import { haptics } from '@/feedback/haptics';
import { REVEAL_SECONDS } from '@/game/rules';
import { useGame } from '@/game/useGame';
import { useLoop } from '@/hooks/useLoop';
import { send } from '@/net/gameSocket';
import type { PublicPlayer, Role } from '@/protocol/types';
import { useRoleStore } from '@/state/role';
import { createStyles, phaseColors, radius, space } from '@/theme';

import { RoomScreen } from './RoomScreen';

export function RevealView() {
  const { t } = useTranslation();
  const styles = useStyles();
  const { state, me, player } = useGame();
  const role = useRoleStore((s) => s.role);
  const round = state.round!;
  const inRound = round.turnOrder.map(player).filter((p): p is PublicPlayer => p !== undefined);
  const readyCount = inRound.filter((p) => p.ready).length;
  const fellows = role?.fellowImposterIds?.map((id) => player(id)?.name ?? '?').join(t('common.separator'));

  return (
    <RoomScreen
      fixed
      footer={
        <Button
          label={me?.ready ? t('reveal.waiting') : t('reveal.gotIt')}
          color={phaseColors.REVEAL}
          disabled={me?.ready || !role}
          onPress={() => send({ type: 'ready', payload: {} })}
        />
      }
    >
      <View style={styles.top}>
        <T variant="title" style={styles.flex}>
          {t('reveal.title', { number: round.number, total: round.totalRounds })}
        </T>
        <TimerRing endsAt={state.endsAt} totalSeconds={REVEAL_SECONDS} color={phaseColors.REVEAL} size={64} />
      </View>

      <View style={styles.cardArea}>
        {role ? <FlipCard role={role} fellows={fellows} /> : <T variant="muted">{t('connection.connecting')}</T>}
      </View>

      <T variant="label" center>
        {t('reveal.ready', { ready: readyCount, total: inRound.length })}
      </T>
      <View style={styles.readyRow}>
        {inRound.map((p) => (
          <View key={p.id}>
            <Avatar avatar={p.avatar} size={40} dimmed={!p.ready} />
            {p.ready ? (
              <Animated.View entering={ZoomIn.springify().damping(8)} style={styles.readyBadge}>
                <View style={styles.small}>
                  <CheckBadge />
                </View>
              </Animated.View>
            ) : null}
          </View>
        ))}
      </View>
    </RoomScreen>
  );
}

/**
 * A face-down card. Holding it flips it over (rotateY, on the UI thread) and releasing flips it back,
 * so the secret is only visible while your thumb is on it.
 */
function FlipCard({ role, fellows }: { role: Role; fellows?: string }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const flip = useSharedValue(0);
  const [held, setHeld] = useState(false);
  const bob = useLoop({ duration: 900, enabled: !held });

  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    // Android draws back faces regardless of backfaceVisibility, so hide each face past the halfway point.
    opacity: flip.value < 0.5 ? 1 : 0,
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    opacity: flip.value >= 0.5 ? 1 : 0,
  }));
  const hint = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * bob.value }] }));

  const press = (down: boolean) => {
    setHeld(down);
    flip.set(withSpring(down ? 1 : 0, { damping: 14, stiffness: 160 }));
    if (down) {
      if (role.isImposter) haptics.error();
      haptics.reveal();
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('reveal.hold')}
      onPressIn={() => press(true)}
      onPressOut={() => press(false)}
      style={styles.card}
    >
      <Animated.View style={[styles.face, styles.front, front]}>
        <T size={96} center color="#FFFFFF">
          ?
        </T>
        <Animated.View style={hint}>
          <T variant="heading" center color="#FFFFFF">
            {`👆 ${t('reveal.hold')}`}
          </T>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.face, role.isImposter ? styles.imposter : styles.crew, back]}>
        {role.isImposter ? (
          <>
            <T variant="caption" color="#FFFFFFCC" center>
              {t('reveal.category', { name: role.categoryName })}
            </T>
            <Glitch active={held} text={t('reveal.imposter')} />
            <T variant="body" center color="#FFFFFF">
              {t('reveal.imposterHint')}
            </T>
            {fellows ? (
              <T variant="label" center color="#FFFFFF">
                {t('reveal.fellows', { names: fellows })}
              </T>
            ) : null}
          </>
        ) : (
          <>
            <T variant="muted" center>
              {t('reveal.category', { name: role.categoryName })}
            </T>
            <T variant="display" center adjustsFontSizeToFit numberOfLines={2}>
              {role.word}
            </T>
            <T variant="muted" center>
              {t('reveal.crewHint')}
            </T>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

/** Red/cyan split copies of [text] that jitter, plus flickering scan lines: a broken-screen look. */
function Glitch({ active, text }: { active: boolean; text: string }) {
  const styles = useStyles();
  const jitter = useSharedValue(0);
  const flicker = useSharedValue(1);

  useEffect(() => {
    if (!active) {
      cancelAnimation(jitter);
      cancelAnimation(flicker);
      return;
    }
    const steps = [3, -4, 1, -2, 5, 0, -3, 2];
    jitter.value = withRepeat(withSequence(...steps.map((x) => withTiming(x, { duration: 45 }))), -1);
    flicker.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 60, easing: Easing.steps(2) }),
        withTiming(1, { duration: 300 }),
        withTiming(0.5, { duration: 40 }),
        withTiming(1, { duration: 500 }),
      ),
      -1,
    );
  }, [active, jitter, flicker]);

  const red = useAnimatedStyle(() => ({ transform: [{ translateX: jitter.value }, { translateY: -jitter.value / 2 }] }));
  const cyan = useAnimatedStyle(() => ({ transform: [{ translateX: -jitter.value }] }));
  const lines = useAnimatedStyle(() => ({ opacity: 1 - flicker.value * 0.8 }));

  return (
    <View style={styles.glitch}>
      <Animated.View style={[StyleSheet.absoluteFill, cyan]}>
        <T variant="hero" center color="#22D3EE" style={styles.glitchCopy}>
          {text}
        </T>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, red]}>
        <T variant="hero" center color="#FDE047" style={styles.glitchCopy}>
          {text}
        </T>
      </Animated.View>
      <T variant="hero" center color="#FFFFFF">
        {text}
      </T>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, lines]}>
        {[18, 46, 72].map((top) => (
          <View key={top} style={[styles.scanline, { top: `${top}%` }]} />
        ))}
      </Animated.View>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardArea: { flex: 1, justifyContent: 'center', minHeight: 300 },
  card: { flex: 1, maxHeight: 420 },
  face: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.lg,
    padding: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    backfaceVisibility: 'hidden',
    borderWidth: 4,
    borderBottomWidth: 10,
  },
  front: { backgroundColor: phaseColors.REVEAL, borderColor: '#9D174D' },
  crew: { backgroundColor: c.card, borderColor: phaseColors.REVEAL },
  imposter: { backgroundColor: '#B91C1C', borderColor: '#7F1D1D' },
  glitch: { alignSelf: 'stretch' },
  glitchCopy: { opacity: 0.85 },
  scanline: { position: 'absolute', start: 0, end: 0, height: 3, backgroundColor: '#FFFFFF' },
  readyRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  readyBadge: { position: 'absolute', bottom: -6, end: -6 },
  small: { transform: [{ scale: 0.8 }] },
}));
