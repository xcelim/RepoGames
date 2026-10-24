// Notificaciones del móvil para los avisos que llegan en tiempo real con la app en segundo plano.
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { AppState, Platform } from 'react-native';

let ready = false;

export async function setupLocalNotifications(): Promise<void> {
  if (ready || Platform.OS === 'web') return;
  ready = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('social', {
        name: 'Amigos y chat',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
        lightColor: '#7b2ff7',
      });
    }
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) await Notifications.requestPermissionsAsync();
    Notifications.addNotificationResponseReceivedListener((r) => {
      const href = r.notification.request.content.data?.href;
      if (typeof href === 'string') router.push(href as never);
    });
  } catch {
    // Sin permiso o sin soporte: solo avisos dentro de la app.
  }
}

export function notifyLocal(title: string, body: string, href: string): void {
  if (Platform.OS === 'web' || AppState.currentState === 'active') return;
  Notifications.scheduleNotificationAsync({
    content: { title, body, data: { href }, ...(Platform.OS === 'android' ? {} : {}) },
    trigger: Platform.OS === 'android' ? { channelId: 'social' } : null,
  }).catch(() => undefined);
}
