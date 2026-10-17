import { Alert, Platform, ToastAndroid } from 'react-native';

// Mensaje corto de confirmación.
export function notify(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else if (Platform.OS !== 'web') {
    Alert.alert(message);
  }
}
