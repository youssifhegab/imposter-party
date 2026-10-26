import { Children, type ReactNode } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { fontFamily, type Weight } from '@/fonts';
import { type Palette, useColors } from '@/theme';

const ARABIC_LETTERS = /[\u0600-\u06FF]/;

// Baloo reserves deep room below the baseline for descenders most words don't have, so its letters sit
// above the middle of their box (about 1.5px in a 15px pill tag). Nudging every line down by this share of
// the font size centers text optically in tags and buttons. A transform doesn't change layout.
const OPTICAL_OFFSET = 0.08;

export type Variant = 'display' | 'hero' | 'title' | 'heading' | 'body' | 'label' | 'muted' | 'caption';

const VARIANTS: Record<Variant, { size: number; weight: Weight; tone: keyof Palette }> = {
  display: { size: 64, weight: 'heavy', tone: 'text' },
  hero: { size: 42, weight: 'heavy', tone: 'text' },
  title: { size: 30, weight: 'heavy', tone: 'text' },
  heading: { size: 21, weight: 'bold', tone: 'text' },
  body: { size: 18, weight: 'medium', tone: 'text' },
  label: { size: 17, weight: 'bold', tone: 'text' },
  muted: { size: 16, weight: 'medium', tone: 'muted' },
  caption: { size: 13, weight: 'bold', tone: 'faint' },
};

type Props = TextProps & {
  variant?: Variant;
  color?: string;
  center?: boolean;
  size?: number;
  weight?: Weight;
  children?: ReactNode;
};

/** All text in the app goes through here: it picks the display font for the script and sets the direction. */
export function T({ variant = 'body', color, center, size, weight, style, children, ...rest }: Props) {
  const c = useColors();
  const { i18n } = useTranslation();
  const v = VARIANTS[variant];
  const rtl = i18n.language === 'ar';
  const plain = Children.toArray(children)
    .filter((child) => typeof child === 'string' || typeof child === 'number')
    .join('');
  const fontSize = size ?? v.size;

  const base: TextStyle = {
    fontFamily: fontFamily(weight ?? v.weight, plain || undefined, i18n.language),
    fontSize,
    // Baloo's tall ascenders get clipped with a tight line height.
    lineHeight: Math.round(fontSize * 1.3),
    color: color ?? (c[v.tone] as string),
    textAlign: center ? 'center' : rtl ? 'right' : 'left',
    // "+1" or "K7MQX" must not be reordered by the RTL paragraph, so only Arabic text runs right to left.
    writingDirection: plain && !ARABIC_LETTERS.test(plain) ? 'ltr' : rtl ? 'rtl' : 'ltr',
    transform: [{ translateY: Math.round(fontSize * OPTICAL_OFFSET * 2) / 2 }],
    // Android adds its own extra padding above and below; without it, it matches iOS and the web.
    includeFontPadding: false,
  };
  return (
    <Text {...rest} style={[base, style]}>
      {children}
    </Text>
  );
}
