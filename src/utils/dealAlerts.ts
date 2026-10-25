// Alertas de ofertas: una vez al día mira los precios de tus deseados y te avisa de las rebajas nuevas.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { bestDiscount, pricesAvailable, pricesFor } from '@/api/prices';
import { useStore } from '@/store/useStore';
import type { GameRecord } from '@/types';

import { setupLocalNotifications } from './localNotify';
import { notify } from './notify';

const LAST = 'deals:last';
const SEEN = 'deals:seen'; // juego -> descuento ya avisado
export const ALERTS_OFF = 'deals:off';

export function wishlistGames(): GameRecord[] {
  const s = useStore.getState();
  return Object.values(s.userGames)
    .filter((u) => u.profileId === s.currentProfileId && u.status === 'wishlist')
    .map((u) => s.games[u.gameId])
    .filter((g): g is GameRecord => !!g && g.source !== 'custom');
}

export async function dealAlertsOn(): Promise<boolean> {
  return (await AsyncStorage.getItem(ALERTS_OFF).catch(() => null)) !== '1';
}

export async function checkDeals(today: string): Promise<void> {
  if (!pricesAvailable() || !(await dealAlertsOn())) return;
  if ((await AsyncStorage.getItem(LAST).catch(() => null)) === today) return;
  await AsyncStorage.setItem(LAST, today).catch(() => undefined);
  const games = wishlistGames().slice(0, 60);
  if (!games.length) return;
  const prices = await pricesFor(games);
  let seen: Record<string, number> = {};
  try {
    seen = JSON.parse((await AsyncStorage.getItem(SEEN)) ?? '{}') as Record<string, number>;
  } catch {
    seen = {};
  }
  const fresh: { game: GameRecord; pct: number }[] = [];
  const next: Record<string, number> = {};
  for (const g of games) {
    const pct = bestDiscount(prices[g.id] ?? null);
    if (pct < 20) continue;
    next[g.id] = pct;
    if ((seen[g.id] ?? 0) < pct) fresh.push({ game: g, pct });
  }
  await AsyncStorage.setItem(SEEN, JSON.stringify(next)).catch(() => undefined);
  if (!fresh.length) return;
  fresh.sort((a, b) => b.pct - a.pct);
  const top = fresh[0];
  const text =
    fresh.length === 1
      ? `${top.game.title} está al -${top.pct} %`
      : `${top.game.title} (-${top.pct} %) y ${fresh.length - 1} más de tus deseados están de oferta`;
  notify(`🔥 ${text}`);
  if (Platform.OS !== 'web') {
    await setupLocalNotifications();
    Notifications.scheduleNotificationAsync({
      content: { title: '¡Ofertas en tus deseados!', body: text, data: { href: '/deals' } },
      trigger: Platform.OS === 'android' ? { channelId: 'social' } : null,
    }).catch(() => undefined);
  }
}
