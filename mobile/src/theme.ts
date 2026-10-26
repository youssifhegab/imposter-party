import { StyleSheet } from 'react-native';

import type { Phase } from '@/protocol/types';
import { type ThemeName, usePrefs } from '@/state/prefs';

export type Palette = {
  name: ThemeName;
  bg: string;
  card: string;
  cardRaised: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  primary: string;
  danger: string;
  success: string;
  warning: string;
  gold: string;
  /** Text on top of any saturated accent color. */
  ink: string;
};

const dark: Palette = {
  name: 'dark',
  bg: '#140A2B',
  card: '#22154A',
  cardRaised: '#31205F',
  border: '#46337D',
  text: '#FFFFFF',
  muted: '#CBC3EC',
  faint: '#8E86B5',
  primary: '#7C3AED',
  danger: '#F43F5E',
  success: '#10B981',
  warning: '#FBBF24',
  gold: '#FACC15',
  ink: '#1A0F3A',
};

const light: Palette = {
  name: 'light',
  bg: '#F4EEFF',
  card: '#FFFFFF',
  cardRaised: '#EAE1FF',
  border: '#D6C9F7',
  text: '#1E1240',
  muted: '#54487E',
  faint: '#8A80AE',
  primary: '#7C3AED',
  danger: '#E11D48',
  success: '#059669',
  warning: '#D97706',
  gold: '#EAB308',
  ink: '#1A0F3A',
};

export const palettes: Record<ThemeName, Palette> = { dark, light };

export type PhaseTheme = { color: string; on: string };

// One hero color per phase so the whole room can tell the phase at a glance. `on` is the text color
// that stays readable on top of it.
export const phaseThemes: Record<Phase, PhaseTheme> = {
  LOBBY: { color: '#7C3AED', on: '#FFFFFF' },
  REVEAL: { color: '#DB2777', on: '#FFFFFF' },
  CLUES: { color: '#2563EB', on: '#FFFFFF' },
  DISCUSSION: { color: '#F59E0B', on: '#1A0F3A' },
  VOTING: { color: '#E11D48', on: '#FFFFFF' },
  REVOTE: { color: '#E11D48', on: '#FFFFFF' },
  GUESS: { color: '#B91C1C', on: '#FFFFFF' },
  RESULTS: { color: '#059669', on: '#FFFFFF' },
  FINAL: { color: '#EAB308', on: '#1A0F3A' },
};

export const phaseColors = Object.fromEntries(
  Object.entries(phaseThemes).map(([phase, theme]) => [phase, theme.color]),
) as Record<Phase, string>;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 12, md: 18, lg: 28, pill: 999 };

export function useColors(): Palette {
  return palettes[usePrefs((s) => s.theme)];
}

/**
 * Like StyleSheet.create, but the styles can use the current palette. Returns a hook; each palette's
 * sheet is built once and reused, so switching theme re-renders with the other sheet.
 *
 *   const useStyles = createStyles((c) => ({ box: { backgroundColor: c.card } }));
 *   const styles = useStyles();
 */
// Typed off StyleSheet.create itself: `S & Styles` gives the object literal a contextual type, so 'row'
// stays the literal 'row' instead of widening to string.
type Styles = Parameters<typeof StyleSheet.create>[0];

export function createStyles<S extends Styles>(factory: (c: Palette) => S & Styles): () => Readonly<S> {
  const sheets = new Map<ThemeName, Readonly<S>>();
  return function useStyles() {
    const c = useColors();
    let sheet = sheets.get(c.name);
    if (!sheet) {
      sheet = StyleSheet.create(factory(c));
      sheets.set(c.name, sheet);
    }
    return sheet;
  };
}
