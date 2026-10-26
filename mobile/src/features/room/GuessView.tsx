import { useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { BounceIn, FadeIn, useAnimatedStyle } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { T } from '@/components/T';
import { TimerRing } from '@/components/TimerRing';
import { useInputStyle } from '@/features/home/useInputStyle';
import { GUESS_SECONDS, MAX_GUESS_LENGTH } from '@/game/rules';
import { useGame } from '@/game/useGame';
import { useLoop } from '@/hooks/useLoop';
import { sendGuess } from '@/net/gameSocket';
import { useRoomStore } from '@/state/room';
import { createStyles, phaseThemes, space } from '@/theme';

import { RoomScreen } from './RoomScreen';

const GUESS = phaseThemes.GUESS;

export function GuessView() {
  const prompted = useRoomStore((s) => s.guessPrompted);
  return prompted ? <LastChance /> : <Suspense />;
}

/** The caught imposter's screen: red, shaking, one shot at the word. */
function LastChance() {
  const { t } = useTranslation();
  const styles = useStyles();
  const input = useInputStyle({ size: 26 });
  const { state } = useGame();
  const sent = useRoomStore((s) => s.guessSent);
  const [guess, setGuess] = useState('');
  const trimmed = guess.trim();
  const shake = useLoop({ duration: 90, enabled: !sent });
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-2 + shake.value * 4}deg` }] }));

  return (
    <RoomScreen
      flood
      accent={GUESS.color}
      footer={
        !sent ? (
          <Button label={t('guess.submit')} color="#FFFFFF" textColor={GUESS.color} disabled={!trimmed} onPress={() => sendGuess(trimmed)} />
        ) : null
      }
    >
      {/* The bounce-in and the shake each need their own view: an entering animation owns its transform. */}
      <Animated.View entering={BounceIn.duration(800)}>
        <Animated.View style={shakeStyle}>
          <T variant="display" center color="#FFFFFF">
            {`🚨 ${t('guess.title')}`}
          </T>
        </Animated.View>
      </Animated.View>
      <TimerRing endsAt={state.endsAt} totalSeconds={GUESS_SECONDS} color="#FFFFFF" textColor="#FFFFFF" size={150} />
      {!sent ? (
        <>
          <T variant="heading" center color="#FFFFFF">
            {t('guess.prompt')}
          </T>
          <TextInput
            value={guess}
            onChangeText={setGuess}
            maxLength={MAX_GUESS_LENGTH}
            autoFocus
            autoCorrect={false}
            placeholder={t('guess.placeholder')}
            placeholderTextColor="#FFFFFF99"
            style={[input, styles.input]}
            returnKeyType="send"
            onSubmitEditing={() => trimmed && sendGuess(trimmed)}
          />
        </>
      ) : (
        <Animated.View entering={FadeIn}>
          <T variant="heading" center color="#FFFFFF">
            {t('guess.sent')}
          </T>
        </Animated.View>
      )}
    </RoomScreen>
  );
}

/** Everyone else waits. The public state never says who was caught, so this stays mysterious. */
function Suspense() {
  const { t } = useTranslation();
  const styles = useStyles();
  const { state } = useGame();
  const bob = useLoop({ duration: 800 });
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -10 * bob.value }, { rotate: `${-6 + 12 * bob.value}deg` }] }));

  return (
    <RoomScreen fixed>
      <View style={styles.center}>
        <Animated.View style={bobStyle}>
          <T size={96} center>
            🤔
          </T>
        </Animated.View>
        <T variant="title" center>
          {t('guess.others')}
        </T>
        <Dots />
        <T variant="muted" center>
          {t('guess.othersHint')}
        </T>
        <TimerRing endsAt={state.endsAt} totalSeconds={GUESS_SECONDS} color={GUESS.color} size={110} />
      </View>
    </RoomScreen>
  );
}

function Dots() {
  const styles = useStyles();
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 160} />
      ))}
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const styles = useStyles();
  const v = useLoop({ duration: 400, delay });
  const style = useAnimatedStyle(() => ({ opacity: 0.3 + v.value * 0.7, transform: [{ translateY: -6 * v.value }] }));
  return <Animated.View style={[styles.dot, style]} />;
}

const useStyles = createStyles((c) => ({
  input: { backgroundColor: '#FFFFFF26', color: '#FFFFFF', borderColor: '#FFFFFF', minHeight: 68 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  dots: { flexDirection: 'row', gap: space.sm },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.text },
}));
