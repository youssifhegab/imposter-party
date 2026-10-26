import { View } from 'react-native';
import Animated, { BounceIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { T } from '@/components/T';
import { useGame } from '@/game/useGame';
import { createStyles, space } from '@/theme';

import { RoomScreen } from './RoomScreen';

/** For players who joined mid-game. They play from the next game. */
export function WaitingView() {
  const { t } = useTranslation();
  const styles = useStyles();
  const { state } = useGame();
  return (
    <RoomScreen fixed>
      <View style={styles.center}>
        <Animated.View entering={BounceIn.duration(800)}>
          <T size={90} center>
            🍿
          </T>
        </Animated.View>
        <T variant="hero" center>
          {t('waiting.title')}
        </T>
        <T variant="muted" center>
          {t('waiting.subtitle', { phase: t(`phase.${state.phase}`) })}
        </T>
      </View>
    </RoomScreen>
  );
}

const useStyles = createStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
}));
