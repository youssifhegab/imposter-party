import { createStyles, radius, useColors } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Pressy } from './Pressy';

type Props = { icon: IconName; label: string; onPress: () => void; color?: string; background?: string };

/** A round icon-only button. [label] is read by screen readers. */
export function IconButton({ icon, label, onPress, color, background }: Props) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      squash={0.15}
      style={[styles.button, background ? { backgroundColor: background } : null]}
    >
      <Icon name={icon} size={22} color={color ?? c.text} />
    </Pressy>
  );
}

const useStyles = createStyles((c) => ({
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.cardRaised,
  },
}));
