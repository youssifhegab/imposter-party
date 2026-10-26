import type { TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { fontFamily } from '@/fonts';
import { radius, space, useColors } from '@/theme';

/** The look of every text field: the display font, aligned for the UI direction. */
export function useInputStyle(options?: { size?: number; border?: string }): TextStyle {
  const c = useColors();
  const { i18n } = useTranslation();
  const size = options?.size ?? 20;
  return {
    minHeight: 56,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: c.cardRaised,
    color: c.text,
    fontSize: size,
    fontFamily: fontFamily('bold', undefined, i18n.language),
    textAlign: i18n.language === 'ar' ? 'right' : 'left',
    borderWidth: 3,
    borderColor: options?.border ?? 'transparent',
  };
}
