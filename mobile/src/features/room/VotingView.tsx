import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { CheckBadge } from '@/components/PlayerTile';
import { Pressy } from '@/components/Pressy';
import { T } from '@/components/T';
import { TimerRing } from '@/components/TimerRing';
import { haptics } from '@/feedback/haptics';
import { play } from '@/feedback/sounds';
import { REVOTE_SECONDS, VOTE_SECONDS } from '@/game/rules';
import { useGame } from '@/game/useGame';
import { send } from '@/net/gameSocket';
import type { PublicPlayer } from '@/protocol/types';
import { createStyles, phaseThemes, radius, space, useColors } from '@/theme';

import { RoomScreen } from './RoomScreen';
import { SecretChip } from './SecretChip';

const VOTE = phaseThemes.VOTING;

/** Used for both VOTING and REVOTE. The parent keys it by phase, so the selection resets for a revote. */
export function VotingView() {
  const { t } = useTranslation();
  const styles = useStyles();
  const { state, me, myId, player } = useGame();
  const round = state.round!;
  const isRevote = state.phase === 'REVOTE';
  const [selected, setSelected] = useState<string[]>([]);

  // Players in the tie sit out the revote (unless everyone is tied): they see the tie but don't vote.
  const sittingOut = isRevote && !round.revoteVoterIds.includes(myId);
  const pool = (isRevote ? round.revoteCandidates : round.turnOrder)
    .filter((id) => sittingOut || id !== myId)
    .map(player)
    .filter((p): p is PublicPlayer => p !== undefined && state.players.some((q) => q.id === p.id));
  const required = Math.min(isRevote ? round.revoteSlots : round.imposterCount, pool.length);
  const voted = me?.hasVoted ?? false;
  useLockedFeedback(voted);

  const toggle = (id: string) =>
    setSelected((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      // With one pick, tapping someone else switches the vote instead of doing nothing.
      if (required === 1) return [id];
      return current.length < required ? [...current, id] : current;
    });

  return (
    <RoomScreen
      overlay={voted ? <Stamp label={t('voting.locked')} /> : null}
      footer={
        <>
          <Progress voted={round.votedCount} total={round.voterCount} />
          {sittingOut ? null : (
            <Button
              label={voted ? t('voting.locked') : t('voting.lock')}
              color={VOTE.color}
              disabled={voted || selected.length !== required}
              onPress={() => send({ type: 'vote', payload: { targetIds: selected } })}
              silent
            />
          )}
        </>
      }
    >
      <SecretChip />
      <View style={styles.top}>
        <View style={styles.flex}>
          <T variant="title">
            {sittingOut ? t('voting.tieTitle') : isRevote ? t('voting.revoteTitle') : `🗳️ ${t('voting.title')}`}
          </T>
          <T variant="muted">
            {sittingOut ? t('voting.sittingOut') : voted ? t('voting.waiting') : t('voting.pick', { count: required })}
          </T>
        </View>
        <TimerRing endsAt={state.endsAt} totalSeconds={isRevote ? REVOTE_SECONDS : VOTE_SECONDS} color={VOTE.color} size={76} />
      </View>

      <View style={styles.grid}>
        {pool.map((p, i) => (
          <Animated.View key={p.id} entering={FadeInDown.delay(i * 50).springify()}>
            <Candidate
              player={p}
              order={selected.indexOf(p.id)}
              disabled={voted || sittingOut}
              isMe={p.id === myId}
              onPress={() => toggle(p.id)}
            />
          </Animated.View>
        ))}
      </View>
    </RoomScreen>
  );
}

type CandidateProps = { player: PublicPlayer; order: number; disabled: boolean; isMe: boolean; onPress: () => void };

function Candidate({ player, order, disabled, isMe, onPress }: CandidateProps) {
  const { t } = useTranslation();
  const c = useColors();
  const styles = useStyles();
  const isSelected = order >= 0;
  const pop = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isSelected ? 1.06 : 1, { damping: 9, stiffness: 260 }) }],
  }));
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityLabel={player.name}
      accessibilityState={{ selected: isSelected, disabled }}
      disabled={disabled}
      onPress={onPress}
      squash={0.12}
    >
      <Animated.View style={[styles.tile, isSelected && styles.selected, pop]}>
        <View>
          <Avatar avatar={player.avatar} size={72} dimmed={!player.connected} ringColor={isSelected ? VOTE.color : undefined} />
          {isSelected ? (
            <Animated.View entering={ZoomIn.springify().damping(8)} style={styles.pick}>
              <T variant="label" color="#FFFFFF" center size={14}>
                {order + 1}
              </T>
            </Animated.View>
          ) : null}
          {player.hasVoted ? (
            <Animated.View entering={ZoomIn} style={styles.votedBadge}>
              <CheckBadge />
            </Animated.View>
          ) : null}
        </View>
        <T variant="label" center numberOfLines={1} size={15} color={isSelected ? c.text : undefined}>
          {player.name}
        </T>
        {isMe ? <T variant="caption" center>{t('common.you')}</T> : null}
      </Animated.View>
    </Pressy>
  );
}

/** "5/7 voted" with a bar that fills as votes come in. */
function Progress({ voted, total }: { voted: number; total: number }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const percent = useSharedValue(0);
  useEffect(() => {
    percent.value = withSpring(total === 0 ? 0 : (voted / total) * 100, { damping: 14 });
  }, [voted, total, percent]);
  const fill = useAnimatedStyle(() => ({ width: `${percent.value}%` }));
  return (
    <View style={styles.progress}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fill]} />
      </View>
      <T variant="label" size={15}>
        {t('voting.progress', { voted, total })}
      </T>
    </View>
  );
}

/** Vote locked: a rubber stamp slams onto the screen. */
function Stamp({ label }: { label: string }) {
  const styles = useStyles();
  const scale = useSharedValue(3);
  const opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 11, stiffness: 260 });
    opacity.value = withTiming(1, { duration: 120 });
  }, [scale, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }, { rotate: '-14deg' }] }));
  return (
    <View style={styles.stampArea}>
      <Animated.View style={[styles.stamp, style]}>
        <T variant="hero" color={VOTE.color} center>
          {label}
        </T>
      </Animated.View>
    </View>
  );
}

/** The stamp's thud, once, when the server confirms the vote. */
function useLockedFeedback(voted: boolean) {
  const was = useRef(voted);
  useEffect(() => {
    if (voted && !was.current) {
      haptics.turn();
      play('lock');
    }
    was.current = voted;
  }, [voted]);
}

const useStyles = createStyles((c) => ({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  tile: {
    width: 108,
    alignItems: 'center',
    gap: space.xs,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  selected: { borderColor: VOTE.color, backgroundColor: c.cardRaised },
  pick: {
    position: 'absolute',
    top: -6,
    end: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: VOTE.color,
    borderWidth: 3,
    borderColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  votedBadge: { position: 'absolute', bottom: -4, start: -4 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  track: { flex: 1, height: 12, borderRadius: 6, backgroundColor: c.cardRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6, backgroundColor: VOTE.color },
  stampArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stamp: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderWidth: 6,
    borderColor: VOTE.color,
    borderRadius: radius.md,
    backgroundColor: c.name === 'dark' ? '#140A2BE6' : '#FFFFFFE6',
  },
}));
