// Precios y ofertas: Steam (en euros, tienda española) y CheapShark (la mejor oferta de PC entre
// muchas tiendas, en dólares). PlayStation, Xbox y Nintendo no tienen una API pública de precios.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { GameRecord } from '@/types';

import { igdbSteamAppId } from './igdb';
import { BUILT_IN, proxyHeaders } from './keys';

export type PriceInfo = {
  checkedAt: number;
  steamAppId: number | null;
  steam: { final: number; initial: number; discount: number; currency: string; free: boolean } | null;
  best: { price: number; retail: number; savings: number; store: string; url: string } | null; // USD
  lowest: { price: number; date: string | null } | null; // mínimo histórico (USD)
};

const STORES: Record<string, string> = {
  '1': 'Steam',
  '2': 'GamersGate',
  '3': 'Green Man Gaming',
  '7': 'GOG',
  '8': 'EA',
  '11': 'Humble Store',
  '13': 'Ubisoft Store',
  '15': 'Fanatical',
  '21': 'WinGameStore',
  '23': 'GameBillet',
  '24': 'Voidu',
  '25': 'Epic Games Store',
  '27': 'Gamesplanet',
  '28': 'Gamesload',
  '29': '2Game',
  '30': 'IndieGala',
  '31': 'Blizzard',
  '33': 'DLGamer',
  '34': 'Noctre',
  '35': 'DreamGame',
};

const TTL = 12 * 3600_000;
const KEY = (id: string) => `price:v1:${id}`;
const mem = new Map<string, PriceInfo>();

// En la web el navegador no puede llamar a estas tiendas: va por el servidor intermedio.
function url(kind: 'steam' | 'cheapshark', path: string, params: Record<string, string>): string | null {
  const qs = new URLSearchParams(params).toString();
  if (Platform.OS !== 'web') {
    return kind === 'steam'
      ? `https://store.steampowered.com/api/${path}?${qs}`
      : `https://www.cheapshark.com/api/1.0/${path}?${qs}`;
  }
  if (!BUILT_IN.proxyUrl) return null;
  return `${BUILT_IN.proxyUrl}/price/${kind}/${path}?${qs}`;
}

async function getJson<T>(u: string | null): Promise<T | null> {
  if (!u) return null;
  try {
    const res = await fetch(u, Platform.OS === 'web' ? { headers: proxyHeaders() } : undefined);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

async function steamPrice(appid: number): Promise<PriceInfo['steam']> {
  type R = Record<
    string,
    {
      success: boolean;
      data?: {
        is_free?: boolean;
        price_overview?: { currency: string; initial: number; final: number; discount_percent: number };
      };
    }
  >;
  const data = await getJson<R>(url('steam', 'appdetails', { appids: String(appid), cc: 'es', l: 'spanish' }));
  const d = data?.[String(appid)];
  if (!d?.success || !d.data) return null;
  if (d.data.is_free) return { final: 0, initial: 0, discount: 0, currency: 'EUR', free: true };
  const p = d.data.price_overview;
  if (!p) return null;
  return {
    final: p.final / 100,
    initial: p.initial / 100,
    discount: p.discount_percent,
    currency: p.currency,
    free: false,
  };
}

async function cheapShark(game: GameRecord, appid: number | null): Promise<Pick<PriceInfo, 'best' | 'lowest'>> {
  type Hit = { gameID: string; steamAppID: string | null; external: string };
  let hits = appid ? await getJson<Hit[]>(url('cheapshark', 'games', { steamAppID: String(appid) })) : null;
  if (!hits?.length) {
    const found = await getJson<Hit[]>(url('cheapshark', 'games', { title: game.title, limit: '10' }));
    hits = (found ?? []).filter((h) => norm(h.external) === norm(game.title));
  }
  const hit = hits?.[0];
  if (!hit) return { best: null, lowest: null };
  type Detail = {
    cheapestPriceEver?: { price: string; date: number };
    deals?: { storeID: string; dealID: string; price: string; retailPrice: string; savings: string }[];
  };
  const d = await getJson<Detail>(url('cheapshark', 'games', { id: hit.gameID }));
  const deal = [...(d?.deals ?? [])].sort((a, b) => Number(a.price) - Number(b.price))[0];
  return {
    best: deal
      ? {
          price: Number(deal.price),
          retail: Number(deal.retailPrice),
          savings: Math.round(Number(deal.savings)),
          store: STORES[deal.storeID] ?? 'Tienda',
          url: `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(deal.dealID)}`,
        }
      : null,
    lowest: d?.cheapestPriceEver
      ? {
          price: Number(d.cheapestPriceEver.price),
          date: d.cheapestPriceEver.date ? new Date(d.cheapestPriceEver.date * 1000).toISOString().slice(0, 10) : null,
        }
      : null,
  };
}

export const pricesAvailable = () => Platform.OS !== 'web' || !!BUILT_IN.proxyUrl;

export async function cachedPrice(game: GameRecord): Promise<PriceInfo | null> {
  const hit = mem.get(game.id);
  if (hit) return hit;
  try {
    const raw = await AsyncStorage.getItem(KEY(game.id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PriceInfo;
    mem.set(game.id, parsed);
    return parsed;
  } catch {
    return null;
  }
}

// Precio de un juego (guardado 12 horas para no preguntar a las tiendas cada vez).
export async function gamePrice(game: GameRecord, force = false): Promise<PriceInfo | null> {
  if (!pricesAvailable()) return null;
  const old = await cachedPrice(game);
  if (old && !force && Date.now() - old.checkedAt < TTL) return old;
  const appid = old?.steamAppId ?? (game.igdbId ? await igdbSteamAppId(game.igdbId).catch(() => null) : null) ?? null;
  const [steam, shark] = await Promise.all([
    appid ? steamPrice(appid) : Promise.resolve(null),
    cheapShark(game, appid),
  ]);
  const info: PriceInfo = { checkedAt: Date.now(), steamAppId: appid, steam, ...shark };
  mem.set(game.id, info);
  AsyncStorage.setItem(KEY(game.id), JSON.stringify(info)).catch(() => undefined);
  return info;
}

// El descuento más jugoso que tenga (Steam o la mejor tienda de PC).
export function bestDiscount(p: PriceInfo | null): number {
  if (!p) return 0;
  return Math.max(p.steam?.discount ?? 0, p.best?.savings ?? 0);
}

export const eur = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
export const usd = (n: number) => `${n.toFixed(2)} $`;

// Varios juegos, de pocos en pocos para no saturar a nadie.
export async function pricesFor(
  games: GameRecord[],
  onOne?: (id: string, p: PriceInfo | null) => void,
  force = false,
): Promise<Record<string, PriceInfo | null>> {
  const out: Record<string, PriceInfo | null> = {};
  let i = 0;
  const worker = async () => {
    while (i < games.length) {
      const g = games[i++];
      const p = await gamePrice(g, force).catch(() => null);
      out[g.id] = p;
      onOne?.(g.id, p);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return out;
}
