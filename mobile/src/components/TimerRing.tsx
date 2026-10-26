import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { alpha } from '@/color';
import { haptics } from '@/feedback/haptics';
import { play } from '@/feedback/sounds';
import { useSecondsLeft } from '@/hooks/useSecondsLeft';
import { useRoomStore } from '@/state/room';
import { useColors } from '@/theme';

import { T } from './T';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const WARNING_SECONDS = 5;

type Props = {
  endsAt: number | null;
  /** The phase's full length, so the ring knows how full to start. */
  totalSeconds: number;
  color: string;
  size?: number;
  /** Text color for the number; defaults to the theme text color. */
  textColor?: string;
  /** Haptic and sound ticks in the last seconds. Only the screen's main timer should tick. */
  ticks?: boolean;
};

/**
 * A ring that drains smoothly until [endsAt], then turns red and pulses in the last 5 seconds.
 * The drain is one linear Reanimated timing on the UI thread, so it stays smooth while JS is busy.
 * It is not mirrored in Arabic: clocks run the same way everywhere.
 */
export function TimerRing({ endsAt, totalSeconds, color, size = 140, textColor, ticks = true }: Props) {
  const c = useColors();
  const offset = useRoomStore((s) => s.clockOffset);
  const seconds = useSecondsLeft(endsAt);
  const progress = useSharedValue(1);
  const pulse = useSharedValue(1);
  const lastTick = useRef<number | null>(null);

  const stroke = Math.max(8, size * 0.09);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const warning = seconds !== null && seconds <= WARNING_SECONDS && seconds > 0;

  useEffect(() => {
    if (endsAt === null) return;
    const remaining = Math.max(0, endsAt - (Date.now() + offset));
    progress.value = Math.min(1, remaining / (totalSeconds * 1000));
    progress.value = withTiming(0, { duration: remaining, easing: Easing.linear });
    return () => cancelAnimation(progress);
  }, [endsAt, offset, totalSeconds, progress]);

  useEffect(() => {
    if (!warning || seconds === lastTick.current) return;
    lastTick.current = seconds;
    pulse.value = withSequence(withTiming(1.12, { duration: 110 }), withSpring(1, { damping: 8 }));
    if (ticks) {
      haptics.tick();
      play('tick');
    }
  }, [warning, seconds, ticks, pulse]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.value) }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  if (seconds === null) return null;
  const tint = warning ? c.danger : color;

  return (
    <Animated.View
      accessibilityRole="timer"
      accessibilityLabel={`${seconds}`}
      style={[{ width: size, height: size, alignSelf: 'center' }, pulseStyle]}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={alpha(tint, 0.2)} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tint}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={ringProps}
          // Start at 12 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <T variant="display" size={size * 0.36} color={warning ? c.danger : (textColor ?? c.text)} center>
          {seconds}
        </T>
      </View>
    </Animated.View>
  );
}
