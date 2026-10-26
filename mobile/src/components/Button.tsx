import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { shade } from '@/color';
import { createStyles, radius, space, useColors } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Pressy } from './Pressy';
import { T } from './T';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
  /** Background for primary buttons, usually the phase color. */
  color?: string;
  /** Label color on top of [color]. */
  textColor?: string;
  icon?: IconName;
  size?: 'large' | 'small';
  silent?: boolean;
};

/** A chunky game button: a darker lip underneath, and it squashes when pressed. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  color,
  textColor,
  icon,
  size = 'large',
  silent,
}: Props) {
  const c = useColors();
  const styles = useStyles();
  const inactive = disabled || busy;
  const bg = variant === 'primary' ? (color ?? c.primary) : variant === 'secondary' ? c.cardRaised : 'transparent';
  const fg = variant === 'primary' ? (textColor ?? '#FFFFFF') : c.text;

  return (
    <Pressy
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      silent={silent}
      style={[
        styles.base,
        size === 'small' && styles.small,
        { backgroundColor: bg },
        variant !== 'ghost' && { borderBottomColor: shade(bg, -0.3), borderBottomWidth: size === 'small' ? 3 : 5 },
        inactive && styles.inactive,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={size === 'small' ? 18 : 22} color={fg} /> : null}
          <T variant="label" color={fg} size={size === 'small' ? 16 : 20} weight="heavy" numberOfLines={1}>
            {label}
          </T>
        </View>
      )}
    </Pressy>
  );
}

const useStyles = createStyles(() => ({
  base: {
    minHeight: 60,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.md },
  inactive: { opacity: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
}));

export const buttonRowStyle = StyleSheet.create({ row: { flexDirection: 'row', gap: space.sm }, cell: { flex: 1 } });
