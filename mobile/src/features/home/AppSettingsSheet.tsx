import { Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/Chip';
import { Sheet } from '@/components/Sheet';
import { T } from '@/components/T';
import { type LanguagePref, type ThemeName, usePrefs } from '@/state/prefs';
import { createStyles, space, useColors } from '@/theme';

const LANGUAGES: LanguagePref[] = ['system', 'en', 'ar'];
const THEMES: ThemeName[] = ['dark', 'light'];

/** This phone's own settings: UI language, theme, and sound. */
export function AppSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const c = useColors();
  const styles = useStyles();
  const { language, theme, muted, setLanguage, setTheme, setMuted } = usePrefs();

  return (
    <Sheet visible={visible} title={t('appSettings.title')} onClose={onClose} closeLabel={t('common.close')}>
      <T variant="muted">{t('appSettings.language')}</T>
      <View style={styles.chips}>
        {LANGUAGES.map((lang) => (
          <Chip
            key={lang}
            label={lang === 'system' ? t('appSettings.system') : t(`languages.${lang}`)}
            selected={language === lang}
            onPress={() => setLanguage(lang)}
          />
        ))}
      </View>

      <T variant="muted">{t('appSettings.theme')}</T>
      <View style={styles.chips}>
        {THEMES.map((name) => (
          <Chip key={name} label={t(`appSettings.${name}`)} selected={theme === name} onPress={() => setTheme(name)} />
        ))}
      </View>

      <View style={styles.switchRow}>
        <T variant="label" style={styles.flex}>
          {t('appSettings.sound')}
        </T>
        <Switch
          accessibilityLabel={t('appSettings.sound')}
          value={!muted}
          onValueChange={(on) => setMuted(!on)}
          trackColor={{ true: c.primary, false: c.border }}
        />
      </View>
    </Sheet>
  );
}

const useStyles = createStyles(() => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  flex: { flex: 1 },
}));
