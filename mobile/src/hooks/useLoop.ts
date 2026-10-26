import { useEffect } from 'react';
import {
  Easing,
  cancelAnimation,
  type SharedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Options = { duration: number; delay?: number; enabled?: boolean };

/**
 * A shared value that swings 0 → 1 → 0 forever while [enabled], for idle motion like bobbing,
 * pulsing and glowing. Map it to a style with useAnimatedStyle.
 */
export function useLoop({ duration, delay = 0, enabled = true }: Options): SharedValue<number> {
  const value = useSharedValue(0);
  useEffect(() => {
    if (!enabled) {
      cancelAnimation(value);
      value.value = withTiming(0, { duration: 200 });
      return;
    }
    value.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    return () => cancelAnimation(value);
  }, [duration, delay, enabled, value]);
  return value;
}
