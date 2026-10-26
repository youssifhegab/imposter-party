import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Pressy } from '@/components/Pressy';
import { T } from '@/components/T';
import { confirmAction } from '@/components/confirm';
import { useGame } from '@/game/useGame';
import { haptics } from '@/feedback/haptics';
import { useLoop } from '@/hooks/useLoop';
import { usePrefs } from '@/state/prefs';
import { useRoomStore } from '@/state/room';
import { createStyles, phaseThemes, radius, space, useColors } from '@/theme';

/** Room code, the phase badge, connection status, mute, and leave. */
export function RoomHeader({ onLeave }: { onLeave: () => void }) {
  const { t } = useTranslation();
  const c = useColors();
  const styles = useStyles();
  const { state } = useGame();
  const connection = useRoomStore((s) => s.connection);
  const muted = usePrefs((s) => s.muted);
  const setMuted = usePrefs((s) => s.setMuted);
  const phase = phaseThemes[state.phase];
  const round = state.round;

  const confirmLeave = async () => {
    const ok = await confirmAction({
      title: t('room.leaveTitle'),
      message: t('room.leaveMessage'),
      confirm: t('room.leave'),
      cancel: t('common.cancel'),
    });
    if (ok) onLeave();
  };

  return (
    <View style={styles.bar}>
      <CopyCode code={state.code} />
      {/* Keyed by phase so the badge pops each time the phase changes. */}
      <Animated.View key={state.phase} entering={FadeIn} style={[styles.phase, { backgroundColor: phase.color }]}>
        <T variant="caption" color={phase.on} numberOfLines={1}>
          {round && state.phase !== 'FINAL'
            ? `${t(`phase.${state.phase}`)} · ${round.number}/${round.totalRounds}`
            : t(`phase.${state.phase}`)}
        </T>
      </Animated.View>
      <View style={styles.spacer}>{connection !== 'open' ? <Reconnecting label={t(`connection.${connection}`)} /> : null}</View>
      <IconButton
        icon={muted ? 'mute' : 'sound'}
        label={muted ? t('room.unmute') : t('room.mute')}
        onPress={() => setMuted(!muted)}
      />
      <IconButton icon="exit" label={t('room.leave')} onPress={confirmLeave} color={c.muted} />
    </View>
  );
}

const COPIED_MS = 1500;

/** The room code. Tapping it copies it, so it can be pasted into a chat. */
function CopyCode({ code }: { code: string }) {
  const { t } = useTranslation();
  const c = useColors();
  const styles = useStyles();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    await Clipboard.setStringAsync(code).catch(() => false);
    haptics.success();
    setCopied(true);
  };

  return (
    <Pressy
      accessibilityRole="button"
      accessibilityLabel={t('room.copyCode', { code })}
      onPress={copy}
      silent
      squash={0.12}
      style={[styles.code, copied && { backgroundColor: c.success }]}
    >
      {copied ? (
        <Animated.View entering={FadeIn} style={styles.copied}>
          <Icon name="check" size={16} color="#FFFFFF" strokeWidth={3} />
          <T variant="label" color="#FFFFFF">
            {t('room.copied')}
          </T>
        </Animated.View>
      ) : (
        <T variant="label" style={styles.codeText}>
          {code}
        </T>
      )}
    </Pressy>
  );
}

function Reconnecting({ label }: { label: string }) {
  const c = useColors();
  const blink = useLoop({ duration: 600 });
  const style = useAnimatedStyle(() => ({ opacity: 0.5 + blink.value * 0.5 }));
  return (
    <Animated.View style={style}>
      <T variant="caption" color={c.warning} numberOfLines={1}>
        {label}
      </T>
    </Animated.View>
  );
}

const useStyles = createStyles((c) => ({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: 52 },
  code: {
    minHeight: 36,
    minWidth: 92,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    backgroundColor: c.cardRaised,
  },
  copied: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Room codes are Latin, so keep them left to right.
  codeText: { letterSpacing: 3, writingDirection: 'ltr' },
  phase: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, flexShrink: 1 },
  spacer: { flex: 1, alignItems: 'flex-start' },
}));
