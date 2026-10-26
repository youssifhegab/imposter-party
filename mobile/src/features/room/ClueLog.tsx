import { Fragment } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { T } from '@/components/T';
import { useGame } from '@/game/useGame';
import { createStyles, radius, space, useColors } from '@/theme';

/** Every clue so far, as speech bubbles that slide in as they arrive. */
export function ClueLog() {
  const { t } = useTranslation();
  const c = useColors();
  const styles = useStyles();
  const { state, player } = useGame();
  const clues = state.round?.clues ?? [];
  const perRound = state.round?.turnOrder.length || 1;
  const grouped = (state.round?.clueRounds ?? 1) > 1;

  return (
    <Card>
      <T variant="heading">{t('clues.log')}</T>
      {clues.length === 0 ? <T variant="muted">{t('clues.empty')}</T> : null}
      <View style={styles.list}>
        {clues.map((clue, i) => {
          const p = player(clue.playerId);
          if (!p) return null;
          const startsRound = grouped && i % perRound === 0;
          return (
            <Fragment key={i}>
              {startsRound ? (
                <T variant="caption" color={c.muted}>
                  {t('clues.clueRound', { number: i / perRound + 1, total: state.round!.clueRounds })}
                </T>
              ) : null}
              <Animated.View
                entering={FadeInDown.delay(Math.min(i, 6) * 40).springify().damping(14)}
                layout={LinearTransition}
                style={styles.row}
              >
                <Avatar avatar={p.avatar} size={40} />
                <View style={[styles.bubble, clue.skipped && styles.skipped]}>
                  <T variant="caption">{p.name}</T>
                  {clue.skipped ? (
                    <T variant="muted" color={c.faint}>
                      {t('clues.skipped')}
                    </T>
                  ) : clue.text ? (
                    <T variant="heading">{clue.text}</T>
                  ) : (
                    <T variant="muted">{`🗣️ ${t('clues.saidAloud')}`}</T>
                  )}
                </View>
              </Animated.View>
            </Fragment>
          );
        })}
      </View>
    </Card>
  );
}

const useStyles = createStyles((c) => ({
  list: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  bubble: {
    flex: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderTopStartRadius: 4,
    backgroundColor: c.cardRaised,
  },
  skipped: { opacity: 0.6 },
}));
