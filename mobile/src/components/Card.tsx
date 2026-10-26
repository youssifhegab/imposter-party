import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { createStyles, radius, space } from '@/theme';

type Props = { children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number };

/** A raised panel that slides up into place when it first appears. */
export function Card({ children, style, delay = 0 }: Props) {
  const styles = useStyles();
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(16)} style={[styles.card, style]}>
      {children}
    </Animated.View>
  );
}

const useStyles = createStyles((c) => ({
  card: {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
    borderWidth: c.name === 'light' ? 1 : 0,
    borderColor: c.border,
  },
}));
