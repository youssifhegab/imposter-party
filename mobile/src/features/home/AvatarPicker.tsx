import { View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Pressy } from '@/components/Pressy';
import { AVATARS } from '@/game/avatars';
import { createStyles, space } from '@/theme';

type Props = { value: number; onChange: (avatar: number) => void };

export function AvatarPicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.grid}>
      {AVATARS.map((_, index) => (
        <Pressy
          key={index}
          accessibilityRole="button"
          accessibilityLabel={t('home.avatarLabel', { number: index + 1 })}
          accessibilityState={{ selected: value === index }}
          onPress={() => onChange(index)}
          squash={0.15}
        >
          <Cell index={index} selected={value === index} />
        </Pressy>
      ))}
    </View>
  );
}

function Cell({ index, selected }: { index: number; selected: boolean }) {
  // The chosen avatar grows with a springy overshoot; the rest shrink back.
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(selected ? 1.15 : 0.92, { damping: 9, stiffness: 220 }) }],
    opacity: withSpring(selected ? 1 : 0.75),
  }));
  return (
    <Animated.View style={style}>
      <Avatar avatar={index} size={50} ringColor={selected ? '#FFFFFF' : undefined} />
    </Animated.View>
  );
}

const useStyles = createStyles(() => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
}));
