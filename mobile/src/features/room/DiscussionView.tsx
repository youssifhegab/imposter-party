import Animated, { BounceIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { T } from '@/components/T';
import { TimerRing } from '@/components/TimerRing';
import { useGame } from '@/game/useGame';
import { send } from '@/net/gameSocket';
import { phaseThemes } from '@/theme';

import { ClueLog } from './ClueLog';
import { RoomScreen } from './RoomScreen';
import { SecretChip } from './SecretChip';

const THEME = phaseThemes.DISCUSSION;

export function DiscussionView() {
  const { t } = useTranslation();
  const { state, isAdmin } = useGame();

  return (
    <RoomScreen
      footer={
        isAdmin ? (
          <Button
            label={t('discussion.skip')}
            color={THEME.color}
            textColor={THEME.on}
            onPress={() => send({ type: 'skip_discussion', payload: {} })}
          />
        ) : null
      }
    >
      <SecretChip />
      <Animated.View entering={BounceIn.duration(700)}>
        <T variant="hero" center>
          {`💬 ${t('discussion.title')}`}
        </T>
        <T variant="muted" center>
          {t('discussion.subtitle')}
        </T>
      </Animated.View>
      <TimerRing endsAt={state.endsAt} totalSeconds={state.settings.discussionSeconds} color={THEME.color} size={200} />
      <ClueLog />
    </RoomScreen>
  );
}
