import { type ReactNode, useId } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { createStyles, space, useColors } from '@/theme';

type Props = {
  children: ReactNode;
  /** Pinned above the scrolling content. */
  header?: ReactNode;
  /** Pinned below the scrolling content, e.g. the main action button. */
  footer?: ReactNode;
  /** The phase color: it glows from the top of the screen. */
  accent?: string;
  /** Fill the whole screen with the accent instead, for takeovers like "Your turn!". */
  flood?: boolean;
  /** Content that should not scroll, e.g. a centered card. */
  fixed?: boolean;
  /** Drawn over everything, e.g. confetti. */
  overlay?: ReactNode;
};

export function Screen({ children, header, footer, accent, flood, fixed, overlay }: Props) {
  const c = useColors();
  const styles = useStyles();
  const glow = accent ?? c.primary;

  return (
    <View style={[styles.root, flood && { backgroundColor: glow }]}>
      <Glow color={flood ? '#FFFFFF' : glow} strength={flood ? 0.18 : c.name === 'dark' ? 0.45 : 0.3} />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        {header}
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {fixed ? (
            <View style={[styles.content, styles.flex]}>{children}</View>
          ) : (
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          )}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
      {overlay ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {overlay}
        </View>
      ) : null}
    </View>
  );
}

/** A soft radial glow of [color] from the top of the screen. */
function Glow({ color, strength }: { color: string; strength: number }) {
  // SVG ids are global on the web, and two screens can be mounted at once in a stack.
  const id = `glow${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={id} cx="50" cy="0" r="75" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color} stopOpacity={strength} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  content: { padding: space.md, gap: space.md, flexGrow: 1 },
  footer: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.sm, gap: space.sm },
}));
