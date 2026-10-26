import { View } from 'react-native';
import Animated, { BounceIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { T } from '@/components/T';
import type { EndReason } from '@/state/room';
import { createStyles, space } from '@/theme';

const ICONS: Record<EndReason, string> = { kicked: '👋', room_not_found: '🚪', invalid_token: '🔒' };

export function EndedView({ reason, onHome }: { reason: EndReason; onHome: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <Screen fixed footer={<Button label={t('ended.home')} onPress={onHome} />}>
      <View style={styles.center}>
        <Animated.View entering={BounceIn.duration(800)}>
          <T size={90} center>
            {ICONS[reason]}
          </T>
        </Animated.View>
        <T variant="title" center>
          {t(`ended.${reason}`)}
        </T>
      </View>
    </Screen>
  );
}

const useStyles = createStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
}));
