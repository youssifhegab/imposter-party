import { useState } from 'react';
import Animated, { FlipInXUp } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Pressy } from '@/components/Pressy';
import { T } from '@/components/T';
import { useRoleStore } from '@/state/role';
import { createStyles, radius, space, useColors } from '@/theme';

/** Your secret, hidden until tapped, so you can check it without showing your screen to the table. */
export function SecretChip() {
  const { t } = useTranslation();
  const c = useColors();
  const styles = useStyles();
  const role = useRoleStore((s) => s.role);
  const [shown, setShown] = useState(false);
  if (!role) return null;

  const secret = role.isImposter ? t('secret.imposter') : role.word;
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityLabel={shown ? undefined : t('secret.peek')}
      onPress={() => setShown((v) => !v)}
      squash={0.12}
      style={[styles.chip, shown && (role.isImposter ? { backgroundColor: c.danger } : styles.shown)]}
    >
      <Animated.View key={String(shown)} entering={FlipInXUp.duration(250)} style={styles.row}>
        {shown ? (
          <>
            <T variant="caption" color={role.isImposter ? '#FFFFFF' : c.muted}>
              {role.categoryName}
            </T>
            <T variant="label" color={role.isImposter ? '#FFFFFF' : c.text}>
              {secret}
            </T>
          </>
        ) : (
          <T variant="label" color={c.muted}>
            {`🤫 ${t('secret.peek')}`}
          </T>
        )}
      </Animated.View>
    </Pressy>
  );
}

const useStyles = createStyles((c) => ({
  chip: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: c.cardRaised,
    borderWidth: 2,
    borderColor: c.border,
    borderStyle: 'dashed',
  },
  shown: { borderStyle: 'solid', backgroundColor: c.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
}));
