import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PublicPlayer } from '@/protocol/types';
import { createStyles, radius, useColors } from '@/theme';

import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { T } from './T';

type Props = {
  player: PublicPlayer;
  isMe?: boolean;
  size?: number;
  /** A small badge on the avatar's corner, e.g. a ready check. */
  badge?: ReactNode;
  /** A line under the name. */
  detail?: string;
  ringColor?: string;
};

/** An avatar with the name under it, a crown for the host, and "away" when disconnected. */
export function PlayerTile({ player, isMe, size = 64, badge, detail, ringColor }: Props) {
  const { t } = useTranslation();
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.tile, { width: size + 36 }]}>
      <View>
        <Avatar avatar={player.avatar} size={size} dimmed={!player.connected} ringColor={ringColor} />
        {player.isAdmin ? (
          <View style={styles.crown}>
            <Icon name="crown" size={16} color="#1A0F3A" strokeWidth={2.6} />
          </View>
        ) : null}
        {badge ? <View style={styles.badge}>{badge}</View> : null}
      </View>
      <T variant="label" center numberOfLines={1} size={15}>
        {player.name}
      </T>
      {isMe || !player.connected || detail ? (
        <T variant="caption" center numberOfLines={1} color={!player.connected ? c.warning : undefined}>
          {!player.connected ? t('lobby.away') : (detail ?? t('common.you'))}
        </T>
      ) : null}
    </View>
  );
}

/** The round green check used as a "ready" or "voted" badge. */
export function CheckBadge() {
  const styles = useStyles();
  return (
    <View style={styles.check}>
      <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3.5} />
    </View>
  );
}

const useStyles = createStyles((c) => ({
  tile: { alignItems: 'center', gap: 2 },
  crown: {
    position: 'absolute',
    top: -8,
    start: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.gold,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-15deg' }],
  },
  badge: { position: 'absolute', bottom: -4, end: -4 },
  check: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: c.success,
    borderWidth: 3,
    borderColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
