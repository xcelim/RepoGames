// Avisos del día de lanzamiento: una notificación del móvil a las 10:00 del día que sale el juego.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { setupLocalNotifications } from './localNotify';

const KEY = 'release:alerts';

export const canAlert = Platform.OS !== 'web';

async function read(): Promise<Record<string, string>> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function useReleaseAlerts() {
  const [alerts, setAlerts] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    read().then((a) => alive && setAlerts(a));
    return () => {
      alive = false;
    };
  }, []);

  const toggle = async (gameId: string, title: string, date: string): Promise<boolean> => {
    if (!canAlert) return false;
    const current = await read();
    if (current[gameId]) {
      await Notifications.cancelScheduledNotificationAsync(current[gameId]).catch(() => undefined);
      delete current[gameId];
    } else {
      await setupLocalNotifications();
      const when = new Date(`${date}T10:00:00`);
      if (when.getTime() < Date.now()) return false;
      current[gameId] = await Notifications.scheduleNotificationAsync({
        content: {
          title: '¡Hoy sale!',
          body: `${title} ya está disponible.`,
          data: { href: `/game/${encodeURIComponent(gameId)}` },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
      });
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(current));
    setAlerts({ ...current });
    return !!current[gameId];
  };

  return { alerts, toggle };
}
