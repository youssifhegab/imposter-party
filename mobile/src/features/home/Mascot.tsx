import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { useLoop } from '@/hooks/useLoop';

/** The hooded imposter on the home screen. It sways gently and blinks now and then. */
export function Mascot({ size = 120 }: { size?: number }) {
  const blink = useSharedValue(1);
  useEffect(() => {
    blink.value = withRepeat(
      withSequence(withDelay(2400, withTiming(0.1, { duration: 80 })), withTiming(1, { duration: 120 })),
      -1,
    );
  }, [blink]);
  const eyes = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const sway = useLoop({ duration: 1400 });
  const body = useAnimatedStyle(() => ({
    transform: [{ translateY: -8 * sway.value }, { rotate: `${-3 + 6 * sway.value}deg` }],
  }));

  return (
    <Animated.View style={[{ alignSelf: 'center', width: size, height: size }, body]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M50 6 C78 6 90 34 90 62 L90 96 L10 96 L10 62 C10 34 22 6 50 6 Z" fill="#E11D48" />
        <Path d="M50 20 C70 20 78 40 78 58 C78 74 66 82 50 82 C34 82 22 74 22 58 C22 40 30 20 50 20 Z" fill="#1A0F3A" />
        <Path d="M18 96 Q50 84 82 96 Z" fill="#9F1239" />
      </Svg>
      {/* The eyes are their own layer so they can squash shut. */}
      <Animated.View style={[StyleSheet.absoluteFill, eyes]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Ellipse cx={39} cy={55} rx={6} ry={4} fill="#FDE047" transform="rotate(12 39 55)" />
          <Ellipse cx={61} cy={55} rx={6} ry={4} fill="#FDE047" transform="rotate(-12 61 55)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
