import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { createRoom } from '@/api/rooms';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/T';
import { haptics } from '@/feedback/haptics';
import { AppSettingsSheet } from '@/features/home/AppSettingsSheet';
import { AvatarPicker } from '@/features/home/AvatarPicker';
import { Mascot } from '@/features/home/Mascot';
import { requestErrorMessage } from '@/features/home/requestErrorMessage';
import { useInputStyle } from '@/features/home/useInputStyle';
import { MAX_NAME_LENGTH } from '@/game/rules';
import i18n from '@/i18n';
import type { WordLanguage } from '@/protocol/types';
import { useSession } from '@/state/session';
import { createStyles, phaseColors, radius, space, useColors } from '@/theme';

export default function Home() {
  const { t } = useTranslation();
  const c = useColors();
  const styles = useStyles();
  const input = useInputStyle();
  const { profile, creds, hydrated, setProfile, setCreds } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const name = profile.name.trim();

  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const language: WordLanguage = i18n.language === 'ar' ? 'ar' : 'en';
      setCreds(await createRoom({ name, avatar: profile.avatar, language }));
      router.push('/room');
    } catch (e) {
      haptics.error();
      setError(requestErrorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      accent={phaseColors.LOBBY}
      header={
        <View style={styles.topBar}>
          <IconButton icon="gear" label={t('appSettings.title')} onPress={() => setSettingsOpen(true)} />
        </View>
      }
      footer={
        <Animated.View entering={FadeInUp.delay(250).springify()} style={styles.footer}>
          {error ? (
            <T variant="label" color={c.danger} center>
              {error}
            </T>
          ) : null}
          {!name ? (
            <T variant="muted" center>
              {t('home.nameRequired')}
            </T>
          ) : null}
          {creds ? (
            <Button
              label={t('home.rejoin', { code: creds.roomCode })}
              variant="secondary"
              onPress={() => router.push('/room')}
            />
          ) : null}
          <Button label={t('home.create')} onPress={create} busy={busy} disabled={!name} color={phaseColors.REVEAL} />
          <Button label={t('home.join')} onPress={() => router.push('/join')} disabled={!name || busy} />
        </Animated.View>
      }
    >
      <Animated.View entering={ZoomIn.springify().damping(10)}>
        <Mascot size={110} />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <T variant="display" center size={56}>
          {t('appName')}
        </T>
        <T variant="muted" center>
          {t('home.tagline')}
        </T>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.profile}>
        {/* Keyed by avatar so a new pick pops in. */}
        <Animated.View key={profile.avatar} entering={ZoomIn.springify().damping(9)}>
          <Avatar avatar={profile.avatar} size={72} />
        </Animated.View>
        <View style={styles.nameBox}>
          <T variant="caption">{t('home.name')}</T>
          <TextInput
            value={profile.name}
            onChangeText={(value) => setProfile({ ...profile, name: value })}
            maxLength={MAX_NAME_LENGTH}
            placeholder={t('home.namePlaceholder')}
            placeholderTextColor={c.faint}
            autoCorrect={false}
            style={input}
          />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(260).springify()} style={styles.pickerBox}>
        <T variant="heading" center>
          {t('home.avatar')}
        </T>
        <AvatarPicker value={profile.avatar} onChange={(avatar) => setProfile({ ...profile, avatar })} />
      </Animated.View>

      <AppSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Screen>
  );
}

const useStyles = createStyles((c) => ({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.md, paddingTop: space.xs },
  footer: { gap: space.sm },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.card,
  },
  nameBox: { flex: 1, gap: 2 },
  pickerBox: { gap: space.sm },
}));
