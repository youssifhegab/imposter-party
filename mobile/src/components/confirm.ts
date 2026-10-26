import { Alert, Platform } from 'react-native';

type Options = { title: string; message: string; confirm: string; cancel: string };

/** A yes/no question. React Native's Alert does nothing on the web, so the browser's dialog is used there. */
export function confirmAction({ title, message, confirm, cancel }: Options): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirm, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}
