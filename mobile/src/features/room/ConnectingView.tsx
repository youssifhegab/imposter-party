import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { WS_URL } from '@/api/config';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { T } from '@/components/T';
import { Mascot } from '@/features/home/Mascot';
import { useLoop } from '@/hooks/useLoop';
import { createStyles, space } from '@/theme';

export function ConnectingView({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const pulse = useLoop({ duration: 700 });
  const style = useAnimatedStyle(() => ({ opacity: 0.4 + pulse.value * 0.6 }));
  return (
    <Screen fixed footer={<Button label={t('common.back')} variant="secondary" icon="back" onPress={onCancel} />}>
      <View style={styles.center}>
        <Mascot size={110} />
        <Animated.View style={style}>
          <T variant="title" center>
            {t('connection.connecting')}
          </T>
        </Animated.View>
        <T variant="caption" center>
          {WS_URL}
        </T>
      </View>
    </Screen>
  );
}

const useStyles = createStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
}));
