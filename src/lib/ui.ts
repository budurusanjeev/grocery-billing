import { Alert, Platform } from 'react-native';

// react-native-web does not implement Alert.alert, so confirmations need a
// web branch — otherwise destructive buttons silently do nothing on web.
export function confirmDialog(title: string, message: string, onYes: () => void): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${title}\n${message}`)) onYes();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'OK', onPress: onYes },
    ]);
  }
}

export function showMessage(title: string, message: string): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export function formatMoney(n: number): string {
  return `₹${n % 1 === 0 ? n : n.toFixed(2)}`;
}
