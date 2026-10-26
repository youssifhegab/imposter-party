import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { BounceIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Confetti } from '@/components/Confetti';
import { T } from '@/components/T';
import { haptics } from '@/feedback/haptics';
import { play } from '@/feedback/sounds';
import { useGame } from '@/game/useGame';
import { send } from '@/net/gameSocket';
import type { AwardType, FinalResult, PublicPlayer } from '@/protocol/types';
import { useRoomStore } from '@/state/room';
import { createStyles, phaseThemes, radius, space, useColors } from '@/theme';

import { RoomScreen } from './RoomScreen';

const FINAL = phaseThemes.FINAL;
const MEDALS = ['🥇', '🥈', '🥉'];
const AWARD_ICONS: Record<AwardType, string> = {
  MASTER_OF_DISGUISE: '🎭',
  DETECTIVE: '🔍',
  MOST_SUSPICIOUS: '👀',
  MIND_READER: '🧠',
  SPEED_DEMON: '⚡',
};

export function FinalView() {
  const { t } = useTranslation();
  const { isAdmin } = useGame();
  const result = useRoomStore((s) => s.finalResult);

  useEffect(() => {
    if (!result) return;
    play('win');
    haptics.success();
  }, [result]);

  return (
    <RoomScreen
      overlay={result ? <Confetti /> : null}
      footer={
        isAdmin ? (
          <Button
            label={t('final.playAgain')}
            color={FINAL.color}
            textColor={FINAL.on}
            onPress={() => send({ type: 'play_again', payload: {} })}
          />
        ) : (
          <T variant="muted" center>
            {t('final.waitingForHost')}
          </T>
        )
      }
    >
      <Animated.View entering={BounceIn.duration(800)}>
        <T variant="hero" center>
          {`🏆 ${t('final.title')}`}
        </T>
      </Animated.View>
      {result ? <Standings result={result} /> : <T variant="muted">{t('connection.connecting')}</T>}
    </RoomScreen>
  );
}

function Standings({ result }: { result: FinalResult }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { myId, player } = useGame();
  const entries = result.leaderboard
    .map((e) => ({ ...e, player: player(e.playerId) }))
    .filter((e): e is typeof e & { player: PublicPlayer } => e.player !== undefined);
  const rest = entries.slice(3);

  const awardValue = (type: AwardType, value: number) =>
    type === 'SPEED_DEMON' ? t('final.seconds', { value: (value / 1000).toFixed(1) }) : t('final.times', { count: value });

  return (
    <>
      <Podium entries={entries.slice(0, 3)} />

      {rest.length > 0 ? (
        <Card delay={1500}>
          {rest.map((e, i) => (
            <Animated.View key={e.playerId} entering={FadeInDown.delay(1600 + i * 80)} style={[styles.row, e.playerId === myId && styles.mine]}>
              <T variant="label" style={styles.rank}>
                {`${e.rank}`}
              </T>
              <Avatar avatar={e.player.avatar} size={40} />
              <T variant="label" style={styles.flex} numberOfLines={1}>
                {e.player.name}
              </T>
              <T variant="heading">{t('final.score', { count: e.score })}</T>
            </Animated.View>
          ))}
        </Card>
      ) : null}

      {result.awards.length > 0 ? (
        <>
          <T variant="heading">{t('final.awards')}</T>
          <View style={styles.awards}>
            {result.awards.map((award, i) => (
              <Animated.View key={award.type} entering={ZoomIn.delay(1800 + i * 150).springify().damping(10)} style={styles.award}>
                <T size={40} center>
                  {AWARD_ICONS[award.type]}
                </T>
                <T variant="label" center>
                  {t(`final.award.${award.type}`)}
                </T>
                <View style={styles.winners}>
                  {award.playerIds.map((id) => {
                    const p = player(id);
                    return p ? <Avatar key={id} avatar={p.avatar} size={30} /> : null;
                  })}
                </View>
                <T variant="caption" center numberOfLines={2}>
                  {`${award.playerIds.map((id) => player(id)?.name ?? '?').join(t('common.separator'))} · ${awardValue(award.type, award.value)}`}
                </T>
              </Animated.View>
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

type Entry = FinalResult['leaderboard'][number] & { player: PublicPlayer };

// Second, first, third from the start side: the classic podium shape.
const PODIUM_ORDER = [1, 0, 2];
const PODIUM_HEIGHTS = [150, 110, 80];
// Third place appears first, the winner last.
const PODIUM_DELAYS = [900, 500, 200];

function Podium({ entries }: { entries: Entry[] }) {
  const c = useColors();
  const styles = useStyles();
  const colors = [c.gold, '#CBD5E1', '#F59E0B'];
  return (
    <View style={styles.podium}>
      {PODIUM_ORDER.map((place) => {
        const e = entries[place];
        if (!e) return <View key={place} style={styles.column} />;
        const medal = MEDALS[e.rank - 1] ?? `${e.rank}`;
        return (
          <View key={place} style={styles.column}>
            <Animated.View entering={BounceIn.delay(PODIUM_DELAYS[place] + 300).duration(700)} style={styles.onTop}>
              <Avatar avatar={e.player.avatar} size={place === 0 ? 76 : 60} ringColor={colors[place]} />
              <T variant="label" center numberOfLines={1}>
                {e.player.name}
              </T>
            </Animated.View>
            <Animated.View
              entering={FadeInUp.delay(PODIUM_DELAYS[place]).springify().damping(13)}
              style={[styles.step, { height: PODIUM_HEIGHTS[place], backgroundColor: colors[place] }]}
            >
              <T size={34} center>
                {medal}
              </T>
              <T variant="heading" color={c.ink} center>
                {`${e.score}`}
              </T>
            </Animated.View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  flex: { flex: 1 },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.md },
  column: { flex: 1, alignItems: 'stretch', gap: space.xs },
  onTop: { alignItems: 'center', gap: 2 },
  step: {
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: space.sm,
    borderBottomWidth: 0,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.xs, borderRadius: radius.md },
  mine: { backgroundColor: c.cardRaised },
  rank: { width: 24, textAlign: 'center' },
  awards: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  award: {
    width: '47%',
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.card,
    alignItems: 'center',
    gap: space.xs,
    borderWidth: 2,
    borderColor: FINAL.color,
  },
  winners: { flexDirection: 'row', gap: 4 },
}));
