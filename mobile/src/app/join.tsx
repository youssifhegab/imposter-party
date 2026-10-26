import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { type ComponentRef, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, {
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { joinRoom } from '@/api/rooms';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/T';
import { haptics } from '@/feedback/haptics';
import { play } from '@/feedback/sounds';
import { requestErrorMessage } from '@/features/home/requestErrorMessage';
import { ROOM_CODE_LENGTH } from '@/game/rules';
import { useLtrRow } from '@/i18n';
import { useSession } from '@/state/session';
import { createStyles, phaseColors, radius, space, useColors } from '@/theme';

// Same alphabet as the server: no 0/O or 1/I/L.
const NOT_IN_CODES = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g;

const WHOLE_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;

/**
 * The code in [text], however it was typed or pasted: "abc de", or a whole share message like
 * "Join my Imposter party! Code: K7MQX". The share message ends with the code, so the last word that is a
 * valid code wins (otherwise "PARTY" would match).
 */
function toCode(text: string): string {
  const words = text.toUpperCase().split(/[^A-Z0-9]+/);
  const whole = words.filter((w) => WHOLE_CODE.test(w)).pop();
  if (whole && words.filter(Boolean).length > 1) return whole;
  return text.toUpperCase().replace(NOT_IN_CODES, '').slice(0, ROOM_CODE_LENGTH);
}

export default function Join() {
  const { t } = useTranslation();
  const c = useColors();
  const styles = useStyles();
  const { profile, setCreds } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const paste = async () => {
    const text = await Clipboard.getStringAsync().catch(() => '');
    const pasted = toCode(text);
    if (pasted.length === ROOM_CODE_LENGTH) {
      haptics.turn();
      setError(null);
      setCode(pasted);
    } else {
      haptics.error();
      setError(t('join.nothingToPaste'));
    }
  };

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      setCreds(await joinRoom(code, { name: profile.name.trim(), avatar: profile.avatar }));
      play('join');
      router.replace('/room');
    } catch (e) {
      haptics.error();
      shake.set(withSequence(...[-12, 12, -9, 9, -5, 5, 0].map((x) => withTiming(x, { duration: 45 }))));
      setError(requestErrorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      accent={phaseColors.CLUES}
      header={
        <View style={styles.topBar}>
          <IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />
        </View>
      }
      footer={
        <>
          {error ? (
            <T variant="label" color={c.danger} center>
              {error}
            </T>
          ) : null}
          <Button
            label={t('join.submit')}
            onPress={join}
            busy={busy}
            disabled={code.length !== ROOM_CODE_LENGTH}
            color={phaseColors.CLUES}
          />
        </>
      }
    >
      <Animated.View entering={FadeInDown.springify()} style={styles.intro}>
        <T variant="hero" center>
          {t('join.title')}
        </T>
        <T variant="muted" center>
          {t('join.hint')}
        </T>
      </Animated.View>
      <Animated.View style={shakeStyle}>
        <CodeInput
          value={code}
          onChange={(next) => {
            setError(null);
            setCode(next);
          }}
          onComplete={() => haptics.turn()}
        />
      </Animated.View>
      <View style={styles.pasteRow}>
        <Button label={t('join.paste')} variant="secondary" size="small" icon="paste" onPress={paste} />
      </View>
    </Screen>
  );
}

type CodeInputProps = { value: string; onChange: (code: string) => void; onComplete: () => void };

/**
 * Five boxes drawn over one hidden TextInput. A single input gives auto-advance and paste for free:
 * typing fills the next box, and pasting "abcde" or "ABC DE" fills them all.
 */
function CodeInput({ value, onChange, onComplete }: CodeInputProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const row = useLtrRow();

  return (
    // Codes are Latin letters, so the boxes read left to right in Arabic too.
    <Pressable accessibilityLabel={t('join.code')} onPress={() => input.current?.focus()} style={[styles.boxes, { flexDirection: row }]}>
      {Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => {
        const active = focused && i === Math.min(value.length, ROOM_CODE_LENGTH - 1);
        const char = value[i];
        return (
          <View key={i} style={[styles.box, char ? styles.filled : null, active && styles.active]}>
            {char ? (
              <Animated.View key={`${i}-${char}`} entering={ZoomIn.springify().damping(9)}>
                <T variant="hero" center>
                  {char}
                </T>
              </Animated.View>
            ) : null}
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(raw) => {
          const next = toCode(raw);
          if (next.length > value.length) haptics.tap();
          if (next.length === ROOM_CODE_LENGTH && value.length < ROOM_CODE_LENGTH) onComplete();
          onChange(next);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        style={styles.hidden}
        caretHidden
      />
    </Pressable>
  );
}

const useStyles = createStyles((c) => ({
  topBar: { flexDirection: 'row', paddingHorizontal: space.md, paddingTop: space.xs },
  intro: { gap: space.sm, marginTop: space.lg },
  boxes: { justifyContent: 'center', gap: space.sm, marginTop: space.lg },
  box: {
    width: 58,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 3,
    borderColor: c.border,
    borderBottomWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { backgroundColor: c.cardRaised },
  active: { borderColor: phaseColors.CLUES },
  // Nearly, not fully, transparent: iOS ignores touches on fully transparent views, which would block the
  // long-press Paste menu. The text itself is transparent, so only the boxes show.
  hidden: { position: 'absolute', opacity: 0.02, color: 'transparent', width: '100%', height: '100%' },
  pasteRow: { alignItems: 'center' },
}));
