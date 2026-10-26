import { createStyles, radius, space, useColors } from '@/theme';

import { Pressy } from './Pressy';
import { T } from './T';

type Props = { label: string; selected: boolean; onPress: () => void; disabled?: boolean; color?: string };

export function Chip({ label, selected, onPress, disabled, color }: Props) {
  const c = useColors();
  const styles = useStyles();
  const accent = color ?? c.primary;
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      squash={0.12}
      style={[styles.chip, selected && { backgroundColor: accent, borderColor: accent }]}
    >
      <T variant="label" color={selected ? '#FFFFFF' : c.text}>
        {label}
      </T>
    </Pressy>
  );
}

const useStyles = createStyles((c) => ({
  chip: {
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: c.cardRaised,
    borderWidth: 2,
    borderColor: c.border,
    justifyContent: 'center',
  },
}));
