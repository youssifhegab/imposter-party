import { useEffect, useRef, useState } from 'react';
import { Share, View } from 'react-native';
import Animated, { LinearTransition, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { PlayerTile } from '@/components/PlayerTile';
import { Pressy } from '@/components/Pressy';
import { T } from '@/components/T';
import { confirmAction } from '@/components/confirm';
import { play } from '@/feedback/sounds';
import { MAX_PLAYERS, MIN_PLAYERS, maxImposters } from '@/game/rules';
import { useGame } from '@/game/useGame';
import { useLtrRow } from '@/i18n';
import { send } from '@/net/gameSocket';
import { createStyles, phaseColors, radius, space, useColors } from '@/theme';

import { RoomScreen } from './RoomScreen';
import { SettingsSheet, SettingsSummary } from './SettingsPanel';

export function LobbyView() {
  const { t } = useTranslation();
  const c = useColors();
  const styles = useStyles();
  const { state, isAdmin, myId } = useGame();
  const [editing, setEditing] = useState(false);
  const ltrRow = useLtrRow();
  const count = state.players.length;
  usePlayerJoinedSound(count);

  const blocker =
    count < MIN_PLAYERS
      ? t('lobby.needPlayers', { count: MIN_PLAYERS - count })
      : state.settings.imposterCount > maxImposters(count)
        ? t('lobby.tooManyImposters', { count })
        : null;

  const share = () => Share.share({ message: t('lobby.shareMessage', { code: state.code }) }).catch(() => {});

  const kick = async (id: string, name: string) => {
    const ok = await confirmAction({
      title: t('lobby.kickTitle', { name }),
      message: t('lobby.kickMessage'),
      confirm: t('lobby.kick'),
      cancel: t('common.cancel'),
    });
    if (ok) send({ type: 'kick', payload: { playerId: id } });
  };

  const footer = isAdmin ? (
    <>
      {blocker ? (
        <T variant="label" color={c.warning} center>
          {blocker}
        </T>
      ) : null}
      <Button
        label={t('lobby.start')}
        color={phaseColors.LOBBY}
        disabled={blocker !== null}
        onPress={() => send({ type: 'start_game', payload: {} })}
      />
    </>
  ) : (
    <T variant="muted" center>
      {t('lobby.waitingForHost')}
    </T>
  );

  // Empty seats up to the minimum, so the host can see how many more are needed.
  const emptySeats = Math.max(0, MIN_PLAYERS - count);

  return (
    <RoomScreen footer={footer}>
      <View style={styles.codeBox}>
        <T variant="muted" center>
          {t('lobby.code')}
        </T>
        <Pressy accessibilityRole="button" accessibilityLabel={t('lobby.share')} onPress={share} style={[styles.letters, { flexDirection: ltrRow }]}>
          {state.code.split('').map((ch, i) => (
            <Animated.View key={i} entering={ZoomIn.delay(i * 70).springify().damping(9)} style={styles.letter}>
              <T variant="hero" center>
                {ch}
              </T>
            </Animated.View>
          ))}
        </Pressy>
        <Button label={t('lobby.share')} variant="secondary" size="small" icon="share" onPress={share} />
      </View>

      <T variant="heading">{t('lobby.players', { count, max: MAX_PLAYERS })}</T>
      <View style={styles.grid}>
        {state.players.map((p) => (
          <Animated.View
            key={p.id}
            // Players pop in with a bounce and shrink away when they leave.
            entering={ZoomIn.springify().damping(8).stiffness(180)}
            exiting={ZoomOut}
            layout={LinearTransition.springify()}
          >
            <PlayerTile player={p} isMe={p.id === myId} />
            {isAdmin && p.id !== myId ? (
              <Pressy
                accessibilityRole="button"
                accessibilityLabel={`${t('lobby.kick')} ${p.name}`}
                onPress={() => kick(p.id, p.name)}
                hitSlop={8}
                squash={0.2}
                style={styles.kick}
              >
                <Icon name="close" size={14} color="#FFFFFF" strokeWidth={3} />
              </Pressy>
            ) : null}
          </Animated.View>
        ))}
        {Array.from({ length: emptySeats }, (_, i) => (
          <Animated.View key={`empty-${i}`} entering={ZoomIn} exiting={ZoomOut} style={styles.emptyTile}>
            <View style={styles.emptySeat}>
              <T variant="title" color={c.faint} center>
                ?
              </T>
            </View>
          </Animated.View>
        ))}
      </View>

      <SettingsSummary onEdit={isAdmin ? () => setEditing(true) : undefined} />
      {isAdmin ? <SettingsSheet visible={editing} onClose={() => setEditing(false)} /> : null}
    </RoomScreen>
  );
}

/** A chime when someone new joins (not when the lobby first appears). */
function usePlayerJoinedSound(count: number) {
  const last = useRef(count);
  useEffect(() => {
    if (count > last.current) play('join');
    last.current = count;
  }, [count]);
}

const useStyles = createStyles((c) => ({
  codeBox: { alignItems: 'center', gap: space.sm },
  // Codes are Latin letters: keep them left to right in Arabic too.
  letters: { gap: space.xs },
  letter: {
    width: 54,
    height: 66,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: phaseColors.LOBBY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.md },
  kick: {
    position: 'absolute',
    top: -4,
    end: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTile: { width: 100, alignItems: 'center' },
  emptySeat: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
