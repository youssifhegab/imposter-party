import { ScrollView, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Pressy } from '@/components/Pressy';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { T } from '@/components/T';
import { SETTINGS_LIMITS } from '@/game/rules';
import { useGame } from '@/game/useGame';
import { send } from '@/net/gameSocket';
import { type Category, RANDOM_CATEGORY, type Settings, type WordLanguage } from '@/protocol/types';
import { createStyles, phaseColors, radius, space, useColors } from '@/theme';

import { useCategories } from './useCategories';

const LANGUAGES: WordLanguage[] = ['en', 'ar'];

/** The settings at a glance, for everyone. The host also gets an "Edit" button that opens the sheet. */
export function SettingsSummary({ onEdit }: { onEdit?: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { state } = useGame();
  const s = state.settings;
  const categories = useCategories(s.language);
  const category = s.category === RANDOM_CATEGORY ? undefined : categories?.find((c) => c.id === s.category);
  const categoryLabel =
    s.category === RANDOM_CATEGORY ? `🎲 ${t('settings.random')}` : category ? `${category.icon} ${category.name}` : s.category;

  const facts = [
    categoryLabel,
    `🌐 ${t(`languages.${s.language}`)}`,
    `🕵️ ${t('settings.impostersCount', { count: s.imposterCount })}`,
    `🔁 ${t('settings.roundsCount', { count: s.rounds })}`,
    `🗣️ ${t('settings.clueRoundsCount', { count: s.clueRounds })}`,
    `⏱️ ${t('settings.turnShort', { seconds: s.turnSeconds })}`,
    `💬 ${t('settings.discussionShort', { seconds: s.discussionSeconds })}`,
  ];

  return (
    <Card delay={120}>
      <View style={styles.headerRow}>
        <T variant="heading" style={styles.flex}>
          {t('settings.title')}
        </T>
        {onEdit ? <Button label={t('settings.edit')} size="small" variant="secondary" icon="gear" onPress={onEdit} /> : null}
      </View>
      <View style={styles.facts}>
        {facts.map((fact) => (
          <View key={fact} style={styles.fact}>
            <T variant="label" size={15}>
              {fact}
            </T>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** Admin-only. Every change goes to the server; what's shown is always the server's current settings. */
export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const c = useColors();
  const styles = useStyles();
  const { state } = useGame();
  const settings = state.settings;
  const categories = useCategories(settings.language);

  const update = (patch: Partial<Settings>) => {
    send({ type: 'update_settings', payload: patch });
  };

  return (
    <Sheet
      visible={visible}
      title={t('settings.title')}
      onClose={onClose}
      closeLabel={t('common.close')}
      footer={<Button label={t('settings.done')} onPress={onClose} color={phaseColors.LOBBY} />}
    >
      <T variant="muted">{t('settings.category')}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
        <CategoryTile
          icon="🎲"
          name={t('settings.random')}
          selected={settings.category === RANDOM_CATEGORY}
          onPress={() => update({ category: RANDOM_CATEGORY })}
        />
        {categories?.map((cat: Category) => (
          <CategoryTile
            key={cat.id}
            icon={cat.icon}
            name={cat.name}
            detail={t('settings.words', { count: cat.wordCount })}
            selected={settings.category === cat.id}
            onPress={() => update({ category: cat.id })}
          />
        ))}
      </ScrollView>

      <T variant="muted">{t('settings.language')}</T>
      <View style={styles.chips}>
        {LANGUAGES.map((lang) => (
          <Chip
            key={lang}
            label={t(`languages.${lang}`)}
            selected={settings.language === lang}
            onPress={() => update({ language: lang })}
          />
        ))}
      </View>

      <View>
        <Stepper
          label={t('settings.imposters')}
          value={settings.imposterCount}
          {...SETTINGS_LIMITS.imposterCount}
          onChange={(imposterCount) => update({ imposterCount })}
        />
        <View style={styles.switchRow}>
          <T variant="label" style={styles.flex}>
            {t('settings.knowEachOther')}
          </T>
          <Switch
            accessibilityLabel={t('settings.knowEachOther')}
            value={settings.impostersKnowEachOther}
            onValueChange={(impostersKnowEachOther) => update({ impostersKnowEachOther })}
            trackColor={{ true: c.primary, false: c.border }}
          />
        </View>
        <Stepper
          label={t('settings.rounds')}
          value={settings.rounds}
          {...SETTINGS_LIMITS.rounds}
          onChange={(rounds) => update({ rounds })}
        />
        <Stepper
          label={t('settings.clueRounds')}
          value={settings.clueRounds}
          {...SETTINGS_LIMITS.clueRounds}
          onChange={(clueRounds) => update({ clueRounds })}
        />
        <Stepper
          label={t('settings.turnSeconds')}
          value={settings.turnSeconds}
          unit={t('settings.secondsUnit')}
          {...SETTINGS_LIMITS.turnSeconds}
          onChange={(turnSeconds) => update({ turnSeconds })}
        />
        <Stepper
          label={t('settings.discussionSeconds')}
          value={settings.discussionSeconds}
          unit={t('settings.secondsUnit')}
          {...SETTINGS_LIMITS.discussionSeconds}
          onChange={(discussionSeconds) => update({ discussionSeconds })}
        />
      </View>
    </Sheet>
  );
}

type TileProps = { icon: string; name: string; detail?: string; selected: boolean; onPress: () => void };

function CategoryTile({ icon, name, detail, selected, onPress }: TileProps) {
  const styles = useStyles();
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={name}
      onPress={onPress}
      squash={0.12}
      style={[styles.tile, selected && styles.tileSelected]}
    >
      <T size={38} center>
        {icon}
      </T>
      <T variant="label" size={15} center numberOfLines={2} color={selected ? '#FFFFFF' : undefined}>
        {name}
      </T>
      {detail ? (
        <T variant="caption" center color={selected ? '#FFFFFFCC' : undefined}>
          {detail}
        </T>
      ) : null}
    </Pressy>
  );
}

const useStyles = createStyles((c) => ({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  fact: { paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: c.cardRaised },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  carousel: { gap: space.sm, paddingVertical: space.xs },
  tile: {
    width: 104,
    minHeight: 120,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 3,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tileSelected: { backgroundColor: phaseColors.LOBBY, borderColor: '#FFFFFF' },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: space.sm },
}));
