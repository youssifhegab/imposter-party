import { useEffect, useState } from 'react';
import Animated, { FadeOutUp, SlideInUp } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { T } from '@/components/T';
import { haptics } from '@/feedback/haptics';
import { useRoomStore } from '@/state/room';
import { createStyles, radius, space } from '@/theme';

const VISIBLE_MS = 3500;

/** Shows the server's latest rejection of something this player tried, for a few seconds. */
export function ErrorBanner() {
  const { t } = useTranslation();
  const styles = useStyles();
  const error = useRoomStore((s) => s.error);
  const [hiddenAt, setHiddenAt] = useState<number | null>(null);

  useEffect(() => {
    if (!error) return;
    haptics.error();
    const id = setTimeout(() => setHiddenAt(error.at), VISIBLE_MS);
    return () => clearTimeout(id);
  }, [error]);

  if (!error || hiddenAt === error.at) return null;
  return (
    <Animated.View key={error.at} entering={SlideInUp.springify()} exiting={FadeOutUp} style={styles.banner}>
      <T accessibilityRole="alert" variant="label" color="#FFFFFF" center>
        {t(`errors.${error.code}`, { defaultValue: t('errors.generic') })}
      </T>
    </Animated.View>
  );
}

const useStyles = createStyles((c) => ({
  banner: { marginHorizontal: space.md, padding: space.sm, borderRadius: radius.md, backgroundColor: c.danger },
}));
