import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  FlipInXDown,
  Keyframe,
  LinearTransition,
  ZoomIn,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { T } from '@/components/T';
import { haptics } from '@/feedback/haptics';
import { play, stop } from '@/feedback/sounds';
import { useGame } from '@/game/useGame';
import { useCountUp } from '@/hooks/useCountUp';
import { useLoop } from '@/hooks/useLoop';
import { send } from '@/net/gameSocket';
import type { PublicPlayer, RoundResult } from '@/protocol/types';
import { useRoomStore } from '@/state/room';
import { createStyles, phaseThemes, radius, space, useColors } from '@/theme';

import { RoomScreen } from './RoomScreen';

const RESULTS = phaseThemes.RESULTS;
const STREAK_BADGE_FROM = 2;

/**
 * The reveal is a timeline of beats: drumroll, each vote landing, (a revote), the imposters, the word,
 * the points, then the leaderboard reordering. Everything on screen is derived from how far along it is,
 * so "Skip" just jumps to the last beat.
 */
type Beat =
  | { kind: 'drum' }
  | { kind: 'vote'; voter: string; target: string; wave: 0 | 1 }
  | { kind: 'revote' }
  | { kind: 'imposters' }
  | { kind: 'word' }
  | { kind: 'points' }
  | { kind: 'board' };

const BEAT_MS: Record<Beat['kind'], number> = {
  drum: 2300,
  vote: 550,
  revote: 1300,
  imposters: 1800,
  word: 1600,
  points: 1600,
  board: 0,
};

function timeline(result: RoundResult): Beat[] {
  const votes = (record: Record<string, string[]>, wave: 0 | 1): Beat[] =>
    Object.entries(record).flatMap(([voter, targets]) => targets.map((target) => ({ kind: 'vote' as const, voter, target, wave })));
  return [
    { kind: 'drum' },
    ...votes(result.votes, 0),
    ...(result.revotes ? [{ kind: 'revote' as const }, ...votes(result.revotes, 1)] : []),
    { kind: 'imposters' },
    { kind: 'word' },
    { kind: 'points' },
    { kind: 'board' },
  ];
}

export function ResultsView() {
  const { t } = useTranslation();
  const { state, isAdmin } = useGame();
  const result = useRoomStore((s) => s.roundResult);
  const round = state.round!;
  const isLast = round.number >= round.totalRounds;

  const footer = isAdmin ? (
    <Button
      label={isLast ? t('results.final') : t('results.next')}
      color={RESULTS.color}
      onPress={() => send({ type: 'next_round', payload: {} })}
    />
  ) : (
    <T variant="muted" center>
      {t('results.waitingForHost')}
    </T>
  );

  return (
    <RoomScreen footer={footer}>
      {result ? <Reveal result={result} /> : <T variant="muted">{t('connection.connecting')}</T>}
    </RoomScreen>
  );
}

function Reveal({ result }: { result: RoundResult }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { myId } = useGame();
  const beats = useMemo(() => timeline(result), [result]);
  const [beat, setBeat] = useState(0);
  const last = beats.length - 1;
  const current = beats[beat];
  const reached = (kind: Beat['kind']) => beats.findIndex((b) => b.kind === kind) <= beat;

  // Advance the timeline.
  useEffect(() => {
    if (beat >= last) return;
    const id = setTimeout(() => setBeat((b) => b + 1), BEAT_MS[current.kind]);
    return () => clearTimeout(id);
  }, [beat, last, current.kind]);

  // Sound and haptics for each beat as it arrives.
  useEffect(() => {
    switch (current.kind) {
      case 'drum':
        play('drumroll');
        break;
      case 'vote':
        play('pop');
        haptics.tap();
        break;
      case 'revote':
        haptics.turn();
        break;
      case 'imposters': {
        const won = (result.points[myId] ?? 0) > 0;
        play(won ? 'win' : 'lose');
        if (won) haptics.success();
        else haptics.error();
        break;
      }
      case 'word':
        haptics.reveal();
        break;
    }
  }, [current, result, myId]);

  useEffect(() => () => stop('drumroll'), []);

  const skip = () => {
    stop('drumroll');
    setBeat(last);
  };

  return (
    <>
      <View style={styles.titleRow}>
        <T variant="title" style={styles.flex}>
          {t('results.title', { number: result.roundNumber })}
        </T>
        {beat < last ? <Button label={t('results.skip')} size="small" variant="secondary" onPress={skip} /> : null}
      </View>

      {current.kind === 'drum' ? (
        <Drumroll />
      ) : (
        <VoteBoard result={result} beats={beats} beat={beat} showImposters={reached('imposters')} />
      )}

      {reached('word') ? <WordCard result={result} /> : null}
      {reached('points') ? <Scoreboard result={result} reordered={reached('board')} /> : null}
    </>
  );
}

function Drumroll() {
  const { t } = useTranslation();
  const styles = useStyles();
  const shake = useLoop({ duration: 70 });
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-8 + shake.value * 16}deg` }, { scale: 1 + shake.value * 0.06 }],
  }));
  return (
    <Animated.View exiting={FadeOut} style={styles.drum}>
      <Animated.View style={style}>
        <T size={110} center>
          🥁
        </T>
      </Animated.View>
      <T variant="title" center>
        {t('results.drumroll')}
      </T>
    </Animated.View>
  );
}

// A vote flies down from above, shrinking onto the avatar it's for.
const voteLanding = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -140 }, { scale: 2.4 }, { rotate: '-30deg' }] },
  70: { opacity: 1, transform: [{ translateY: 8 }, { scale: 0.9 }, { rotate: '6deg' }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }, { rotate: '0deg' }] },
}).duration(450);

type BoardProps = { result: RoundResult; beats: Beat[]; beat: number; showImposters: boolean };

/** Each player in the round, with the votes they received stacking up under them. */
function VoteBoard({ result, beats, beat, showImposters }: BoardProps) {
  const { t } = useTranslation();
  const c = useColors();
  const styles = useStyles();
  const { state, player } = useGame();
  const ids = state.round?.turnOrder ?? Object.keys(result.scores);
  const players = ids.map(player).filter((p): p is PublicPlayer => p !== undefined);

  // Only the latest wave counts: once the revote starts, its votes replace the first ones.
  const shown = beats.slice(0, beat + 1);
  const inRevote = shown.some((b) => b.kind === 'revote');
  const landed = shown.filter((b): b is Extract<Beat, { kind: 'vote' }> => b.kind === 'vote' && b.wave === (inRevote ? 1 : 0));

  return (
    <View style={styles.boardBox}>
      {inRevote && !showImposters ? (
        <Animated.View entering={ZoomIn.springify()}>
          <T variant="heading" center color={phaseThemes.REVOTE.color}>
            {t('results.revoteBanner')}
          </T>
        </Animated.View>
      ) : null}
      {landed.length === 0 && !showImposters ? (
        <T variant="muted" center>
          {Object.keys(result.votes).length === 0 ? t('results.noVotes') : t('results.countingVotes')}
        </T>
      ) : null}
      <View style={styles.board}>
        {players.map((p) => {
          const isImposter = result.imposterIds.includes(p.id);
          const caught = result.caughtIds.includes(p.id);
          const votes = landed.filter((v) => v.target === p.id);
          const highlight = showImposters && isImposter;
          return (
            <View key={p.id} style={[styles.candidate, showImposters && !isImposter && styles.crewDim]}>
              <View>
                <Avatar avatar={p.avatar} size={60} ringColor={highlight ? c.danger : undefined} />
                {highlight ? (
                  <Animated.View entering={ZoomIn.springify().damping(7)} style={styles.verdictBox}>
                    <View style={[styles.verdict, { backgroundColor: c.danger }]}>
                      <T variant="caption" color="#FFFFFF" center>
                        {caught ? t('results.caught') : t('results.escaped')}
                      </T>
                    </View>
                  </Animated.View>
                ) : null}
              </View>
              <T variant="label" size={14} center numberOfLines={1}>
                {p.name}
              </T>
              <View style={styles.stack}>
                {votes.map((v) => {
                  const voter = player(v.voter);
                  return voter ? (
                    <Animated.View key={`${v.wave}-${v.voter}`} entering={voteLanding}>
                      <Avatar avatar={voter.avatar} size={22} />
                    </Animated.View>
                  ) : null;
                })}
              </View>
            </View>
          );
        })}
      </View>
      {showImposters ? (
        <Animated.View entering={FadeInDown.springify()}>
          <T variant="heading" center color={c.danger}>
            {t('results.impostersWere', {
              count: result.imposterIds.length,
              names: result.imposterIds.map((id) => player(id)?.name ?? '?').join(t('common.separator')),
            })}
          </T>
        </Animated.View>
      ) : null}
    </View>
  );
}

function WordCard({ result }: { result: RoundResult }) {
  const { t } = useTranslation();
  const c = useColors();
  const { player } = useGame();
  const guesses = Object.entries(result.guesses);

  return (
    <Animated.View entering={FlipInXDown.springify().damping(12)}>
      <Card>
        <T variant="muted" center>
          {t('results.word', { category: result.categoryName })}
        </T>
        <T variant="display" center adjustsFontSizeToFit numberOfLines={1}>
          {result.word}
        </T>
        {guesses.map(([id, guess]) => (
          <T key={id} variant="label" center color={guess.correct ? c.success : c.danger}>
            {guess.correct
              ? t('results.guessCorrect', { name: player(id)?.name ?? '?', text: guess.text })
              : t('results.guessWrong', { name: player(id)?.name ?? '?', text: guess.text })}
          </T>
        ))}
        {result.caughtIds.some((id) => !result.guesses[id]) ? (
          <T variant="muted" center>
            {t('results.caughtNoGuess')}
          </T>
        ) : null}
      </Card>
    </Animated.View>
  );
}

/** Points tick up as "+2", then the rows slide into the new order. */
function Scoreboard({ result, reordered }: { result: RoundResult; reordered: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { myId, player } = useGame();

  const rows = Object.entries(result.scores)
    .map(([id, score]) => ({ id, score, gained: result.points[id] ?? 0, before: score - (result.points[id] ?? 0) }))
    .sort((a, b) => (reordered ? b.score - a.score : b.before - a.before));

  return (
    <Card>
      <T variant="heading">{t('results.scores')}</T>
      {rows.map((row, i) => {
        const p = player(row.id);
        if (!p) return null;
        const streak = result.catchStreaks[row.id] ?? 0;
        return (
          <Animated.View
            key={row.id}
            entering={FadeInDown.delay(i * 60).springify()}
            layout={LinearTransition.springify().damping(14)}
            style={[styles.scoreRow, row.id === myId && styles.mine]}
          >
            <T variant="label" style={styles.rank}>
              {`${i + 1}`}
            </T>
            <Avatar avatar={p.avatar} size={40} />
            <View style={styles.flex}>
              <T variant="label" numberOfLines={1}>
                {p.name}
              </T>
              {streak >= STREAK_BADGE_FROM ? (
                <Animated.View entering={ZoomIn.delay(400)} style={styles.streak}>
                  <T variant="caption" color="#FFFFFF">
                    {t('results.streak', { count: streak })}
                  </T>
                </Animated.View>
              ) : null}
            </View>
            <Gain gained={row.gained} delay={i * 120} />
            <Total from={row.before} to={row.score} delay={i * 120 + 300} />
          </Animated.View>
        );
      })}
    </Card>
  );
}

function Gain({ gained, delay }: { gained: number; delay: number }) {
  const c = useColors();
  const value = useCountUp(gained, { delay });
  return (
    <Animated.View entering={ZoomIn.delay(delay).springify().damping(8)}>
      <T variant="heading" color={gained > 0 ? c.success : c.faint}>
        {`+${value}`}
      </T>
    </Animated.View>
  );
}

function Total({ from, to, delay }: { from: number; to: number; delay: number }) {
  const styles = useStyles();
  const value = useCountUp(to, { from, delay });
  return (
    <T variant="title" style={styles.total}>
      {value}
    </T>
  );
}

const useStyles = createStyles((c) => ({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  drum: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  boardBox: { gap: space.sm },
  board: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  candidate: { width: 96, alignItems: 'center', gap: 2, paddingVertical: space.xs },
  crewDim: { opacity: 0.45 },
  verdictBox: { position: 'absolute', top: -10, start: 0, end: 0, alignItems: 'center' },
  verdict: {
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    transform: [{ rotate: '-8deg' }],
  },
  stack: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 2, minHeight: 24 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.xs,
    borderRadius: radius.md,
  },
  mine: { backgroundColor: c.cardRaised },
  rank: { width: 22, textAlign: 'center' },
  streak: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: '#F97316',
  },
  total: { minWidth: 44, textAlign: 'center' },
}));

