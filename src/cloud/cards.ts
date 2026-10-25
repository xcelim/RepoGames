// Cromos: sobre diario, cromo de cada juego terminado e intercambios con amigos.
// Todo lo que crea o mueve cromos lo hace la base de datos (funciones del SQL de cromos).
import { create } from 'zustand';

import { useStore } from '@/store/useStore';

import { isMissingError } from './conversations';
import { ensureGames, ensureProfiles } from './social';
import { getSupabase } from './supabase';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type GameCardItem = {
  id: string;
  owner: string;
  gameId: string;
  rarity: Rarity;
  foil: boolean;
  source: 'pack' | 'finish' | 'trade';
  obtainedAt: string;
};

export type CardTrade = {
  id: string;
  from: string;
  to: string;
  offerCard: string;
  wantCard: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
};

type CardRow = {
  id: string;
  owner: string;
  game_id: string;
  rarity: Rarity;
  foil: boolean;
  source: GameCardItem['source'];
  obtained_at: string;
};
type TradeRow = {
  id: string;
  from_profile: string;
  to_profile: string;
  offer_card: string;
  want_card: string;
  status: CardTrade['status'];
  created_at: string;
};

const fromCard = (r: CardRow): GameCardItem => ({
  id: r.id,
  owner: r.owner,
  gameId: r.game_id,
  rarity: r.rarity,
  foil: r.foil,
  source: r.source,
  obtainedAt: r.obtained_at,
});
const fromTrade = (r: TradeRow): CardTrade => ({
  id: r.id,
  from: r.from_profile,
  to: r.to_profile,
  offerCard: r.offer_card,
  wantCard: r.want_card,
  status: r.status,
  createdAt: r.created_at,
});

export const RARITY_META: Record<
  Rarity,
  {
    label: string;
    color: string;
    colors: [string, string, string];
    order: number;
  }
> = {
  common: {
    label: 'Común',
    color: '#9aa5b1',
    colors: ['#d7dde4', '#8e9eab', '#eef2f3'],
    order: 0,
  },
  rare: {
    label: 'Rara',
    color: '#2ec5ff',
    colors: ['#4facfe', '#00f2fe', '#a1c4fd'],
    order: 1,
  },
  epic: {
    label: 'Épica',
    color: '#b14cff',
    colors: ['#c471f5', '#7b2ff7', '#fa71cd'],
    order: 2,
  },
  legendary: {
    label: 'Legendaria',
    color: '#ffb400',
    colors: ['#f7d774', '#ff8a00', '#fff3b0'],
    order: 3,
  },
};

type CardsState = {
  loaded: boolean;
  missing: boolean; // falta ejecutar el SQL de cromos
  mine: GameCardItem[];
  byOwner: Record<string, GameCardItem[]>; // álbumes de amigos
  trades: CardTrade[];
  lastPack: string | null; // AAAA-MM-DD del último sobre abierto
  tradeCards: Record<string, GameCardItem>; // cromos que salen en intercambios
};

export const useCards = create<CardsState>()(() => ({
  loaded: false,
  missing: false,
  mine: [],
  byOwner: {},
  trades: [],
  lastPack: null,
  tradeCards: {},
}));

const me = () => useStore.getState().cloudUserId;

// Día de hoy en España (el sobre se renueva a medianoche, hora peninsular).
export function madridToday(now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const out = `${get('year')}-${get('month')}-${get('day')}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return out;
  } catch {
    // sin datos de zonas horarias: la fecha del móvil
  }
  const d = now;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function packAvailable(lastPack: string | null): boolean {
  return lastPack !== madridToday();
}

function friendly(message: string): string {
  if (/Ya has abierto/.test(message)) return 'Ya has abierto el sobre de hoy. ¡Vuelve mañana!';
  if (/amigos/.test(message)) return 'Solo puedes intercambiar con tus amigos';
  return message;
}

export async function refreshCards(): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return;
  const [cards, packs, trades] = await Promise.all([
    client.from('cards').select('*').eq('owner', uid).order('obtained_at', { ascending: false }).limit(2000),
    client
      .from('card_packs')
      .select('opened_on')
      .eq('profile_id', uid)
      .order('opened_on', { ascending: false })
      .limit(1),
    client.from('card_trades').select('*').order('created_at', { ascending: false }).limit(200),
  ]);
  if (isMissingError(cards.error)) {
    useCards.setState({ loaded: true, missing: true });
    return;
  }
  if (cards.error) throw new Error(cards.error.message);
  const mine = ((cards.data as CardRow[]) ?? []).map(fromCard);
  const tradeList = ((trades.data as TradeRow[] | null) ?? []).map(fromTrade);
  // Los cromos que salen en intercambios (los tuyos ya están; los del otro se piden).
  const others = [
    ...new Set(tradeList.flatMap((t) => [t.offerCard, t.wantCard]).filter((id) => !mine.some((c) => c.id === id))),
  ];
  const extra = others.length ? await client.from('cards').select('*').in('id', others) : { data: [] };
  const tradeCards = Object.fromEntries(
    [...mine, ...((extra.data as CardRow[] | null) ?? []).map(fromCard)].map((c) => [c.id, c]),
  );
  useCards.setState({
    loaded: true,
    missing: false,
    mine,
    trades: tradeList,
    tradeCards,
    lastPack: ((packs.data as { opened_on: string }[] | null) ?? [])[0]?.opened_on ?? null,
  });
  await ensureGames([...mine.map((c) => c.gameId), ...Object.values(tradeCards).map((c) => c.gameId)]);
  await ensureProfiles(tradeList.flatMap((t) => [t.from, t.to]));
}

export async function loadFriendCards(profileId: string): Promise<GameCardItem[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from('cards')
    .select('*')
    .eq('owner', profileId)
    .order('obtained_at', { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  const list = ((data as CardRow[]) ?? []).map(fromCard);
  useCards.setState((s) => ({ byOwner: { ...s.byOwner, [profileId]: list } }));
  await ensureGames(list.map((c) => c.gameId));
  return list;
}

export async function openDailyPack(): Promise<GameCardItem[]> {
  const client = getSupabase();
  if (!client) throw new Error('Necesitas conexión');
  const { data, error } = await client.rpc('open_daily_pack');
  if (error) throw new Error(isMissingError(error) ? 'Falta ejecutar el SQL de cromos' : friendly(error.message));
  const cards = ((data as CardRow[]) ?? []).map(fromCard);
  await ensureGames(cards.map((c) => c.gameId));
  useCards.setState((s) => ({
    mine: [...cards, ...s.mine],
    lastPack: madridToday(),
  }));
  return cards;
}

// Cromos de los juegos que has terminado y aún no tenías (se llama sola de vez en cuando).
export async function claimFinishCards(): Promise<GameCardItem[]> {
  const client = getSupabase();
  if (!client || !me()) return [];
  const { data, error } = await client.rpc('claim_finish_cards');
  if (error) return [];
  const cards = ((data as CardRow[]) ?? []).map(fromCard);
  if (cards.length) {
    await ensureGames(cards.map((c) => c.gameId));
    useCards.setState((s) => ({
      mine: [...cards, ...s.mine.filter((c) => !cards.some((n) => n.id === c.id))],
    }));
  }
  return cards;
}

export async function proposeTrade(offer: string, want: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Necesitas conexión');
  const { error } = await client.rpc('propose_card_trade', { offer, want });
  if (error) throw new Error(friendly(error.message));
  await refreshCards();
}

export async function respondTrade(trade: string, accept: boolean): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Necesitas conexión');
  const { error } = await client.rpc('respond_card_trade', { trade, accept });
  if (error) throw new Error(friendly(error.message));
  await refreshCards();
}

export async function cancelTrade(trade: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await client.rpc('cancel_card_trade', { trade });
  await refreshCards();
}

// Álbum agrupado: un hueco por juego, con cuántos tienes y el mejor (brillante primero).
export type AlbumEntry = {
  gameId: string;
  best: GameCardItem;
  copies: GameCardItem[];
};

export function groupAlbum(cards: GameCardItem[]): AlbumEntry[] {
  const map = new Map<string, GameCardItem[]>();
  for (const c of cards) map.set(c.gameId, [...(map.get(c.gameId) ?? []), c]);
  return [...map.entries()]
    .map(([gameId, copies]) => {
      const best = [...copies].sort(
        (a, b) => Number(b.foil) - Number(a.foil) || RARITY_META[b.rarity].order - RARITY_META[a.rarity].order,
      )[0];
      return { gameId, best, copies };
    })
    .sort(
      (a, b) =>
        RARITY_META[b.best.rarity].order - RARITY_META[a.best.rarity].order ||
        b.best.obtainedAt.localeCompare(a.best.obtainedAt),
    );
}
