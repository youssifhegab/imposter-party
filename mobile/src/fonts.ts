import { Baloo2_500Medium, Baloo2_700Bold, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import {
  BalooBhaijaan2_500Medium,
  BalooBhaijaan2_700Bold,
  BalooBhaijaan2_800ExtraBold,
} from '@expo-google-fonts/baloo-bhaijaan-2';

// Baloo 2 and Baloo Bhaijaan 2 are one rounded, chunky design drawn for Latin and Arabic, so both
// languages share the same voice. A custom font file is one weight; fontWeight can't pick a weight.
export const FONT_FILES = {
  Baloo2_500Medium,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
  BalooBhaijaan2_500Medium,
  BalooBhaijaan2_700Bold,
  BalooBhaijaan2_800ExtraBold,
};

export type Weight = 'medium' | 'bold' | 'heavy';

const FAMILIES = {
  latin: { medium: 'Baloo2_500Medium', bold: 'Baloo2_700Bold', heavy: 'Baloo2_800ExtraBold' },
  arabic: { medium: 'BalooBhaijaan2_500Medium', bold: 'BalooBhaijaan2_700Bold', heavy: 'BalooBhaijaan2_800ExtraBold' },
} as const;

const ARABIC = /[\u0600-\u06FF]/;
const LATIN = /[A-Za-z]/;

/**
 * The family for [text]. Text with Arabic letters uses the Arabic cut and text with Latin letters the
 * Latin one, so an Arabic word or name still looks right inside the English UI and the other way round.
 * Digits and emoji follow the UI language.
 */
export function fontFamily(weight: Weight, text: string | undefined, uiLanguage: string): string {
  const arabic = text && ARABIC.test(text) ? true : text && LATIN.test(text) ? false : uiLanguage === 'ar';
  return FAMILIES[arabic ? 'arabic' : 'latin'][weight];
}
