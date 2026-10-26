import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptics } from '@/feedback/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** How far it squashes while held, 0–1. */
  squash?: number;
  /** Skip the light tap haptic, e.g. when the caller plays a stronger one. */
  silent?: boolean;
};

/**
 * A Pressable that squashes while held and springs back on release, with a light haptic on press.
 * The squash runs on the UI thread: a shared value is a number Reanimated can animate without React renders.
 */
export function Pressy({ style, children, squash = 0.08, silent, onPressIn, onPressOut, onPress, disabled, ...rest }: Props) {
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + pressed.value * squash * 0.4 }, { scaleY: 1 - pressed.value * squash }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        pressed.set(withSpring(1, { damping: 15, stiffness: 400 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.set(withSpring(0, { damping: 8, stiffness: 300 }));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (!silent) haptics.tap();
        onPress?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
