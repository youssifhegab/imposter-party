import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { createStyles, radius, space, useColors } from '@/theme';

import { Pressy } from './Pressy';
import { T } from './T';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Shown after the number, e.g. "s". */
  unit?: string;
};

export function Stepper({ label, value, min, max, step, onChange, disabled, unit }: Props) {
  const styles = useStyles();
  const change = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)));
  return (
    <View style={styles.row}>
      <T variant="label" style={styles.label}>
        {label}
      </T>
      <View style={styles.controls}>
        <StepButton symbol="−" onPress={() => change(-step)} disabled={disabled || value <= min} label={`${label} −`} />
        {/* Keyed by value so each change pops the new number in. */}
        <Animated.View key={value} entering={ZoomIn.springify().damping(12)} style={styles.valueBox}>
          <T variant="heading" center>
            {`${value}${unit ?? ''}`}
          </T>
        </Animated.View>
        <StepButton symbol="+" onPress={() => change(step)} disabled={disabled || value >= max} label={`${label} +`} />
      </View>
    </View>
  );
}

function StepButton(props: { symbol: string; onPress: () => void; disabled: boolean; label: string }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={props.disabled}
      onPress={props.onPress}
      squash={0.15}
      style={[styles.button, props.disabled && styles.disabled]}
    >
      <T variant="title" color={c.text} center>
        {props.symbol}
      </T>
    </Pressy>
  );
}

const useStyles = createStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, minHeight: 56 },
  label: { flex: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  button: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: c.cardRaised,
    borderBottomWidth: 3,
    borderBottomColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.3 },
  valueBox: { minWidth: 56, alignItems: 'center' },
}));
