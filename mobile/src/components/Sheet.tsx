import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDirectionStyle } from '@/i18n';
import { createStyles, radius, space } from '@/theme';

import { IconButton } from './IconButton';
import { T } from './T';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeLabel: string;
  /** Pinned under the scrolling content, so it's always reachable. */
  footer?: ReactNode;
};

/** A bottom sheet that slides up over the screen. Tapping the dimmed backdrop closes it. */
export function Sheet({ visible, title, onClose, children, closeLabel, footer }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const direction = useDirectionStyle();
  // Unmounted when closed: on the web a closed Modal can linger invisibly and swallow taps meant for the
  // screen under it (the lobby's Start button).
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* A Modal renders outside the root view, so it needs the direction again. */}
      <View style={[styles.root, direction]}>
        <Pressable accessibilityLabel={closeLabel} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <T variant="title" style={styles.title}>
              {title}
            </T>
            <IconButton icon="close" label={closeLabel} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const useStyles = createStyles((c) => ({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8, 4, 20, 0.6)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: c.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: space.sm,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.border },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.sm },
  title: { flex: 1 },
  body: { paddingHorizontal: space.md, gap: space.md, paddingBottom: space.md },
  footer: { paddingHorizontal: space.md, paddingTop: space.sm },
}));
