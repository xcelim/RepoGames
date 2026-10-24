// Listas oficiales (Persona, Fire Emblem, Zelda...) guardadas en la base de datos:
// un administrador las publica y el resto las lee de ahí (más rápido y todos ven lo mismo).
import { fromGameRow, toGameRow, type GameRow } from '@/cloud/mappers';
import { getSupabase } from '@/cloud/supabase';
import { OFFICIAL_LISTS } from '@/data/catalog';
import { useStore } from '@/store/useStore';
import type { GameRecord } from '@/types';

let admin: Promise<boolean> | null = null;

export function isAdmin(): Promise<boolean> {
  const client = getSupabase();
  if (!client || !useStore.getState().cloudUserId) return Promise.resolve(false);
  admin ??= Promise.resolve(client.rpc('is_admin'))
    .then(({ data, error }) => !error && data === true)
    .catch(() => false);
  return admin;
}

export function resetAdminCache() {
  admin = null;
}

// Juegos de una lista oficial guardados en la base de datos (null si no está publicada).
export async function fetchOfficialFromDb(listId: string): Promise<GameRecord[] | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data: items, error } = await client
    .from('list_items')
    .select('game_id,position')
    .eq('list_id', listId)
    .order('position');
  if (error || !items?.length) return null;
  const ids = (items as { game_id: string }[]).map((i) => i.game_id);
  const { data: games } = await client.from('games').select('*').in('id', ids);
  const byId = new Map(((games as GameRow[] | null) ?? []).map((g) => [g.id, fromGameRow(g)]));
  const list = ids.map((id) => byId.get(id)).filter((g): g is GameRecord => !!g);
  return list.length ? list : null;
}

// El administrador sube (o actualiza) una lista oficial con sus juegos.
export async function publishOfficial(listId: string, games: GameRecord[]): Promise<void> {
  const client = getSupabase();
  if (!client || !games.length || !(await isAdmin())) return;
  const meta = OFFICIAL_LISTS.find((l) => l.id === listId);
  if (!meta) return;
  await client.from('games').upsert(games.map((g) => toGameRow(g, null)));
  const now = new Date().toISOString();
  const res = await client.from('lists').upsert({
    id: listId,
    owner_id: null,
    name: meta.name,
    description: meta.description,
    visibility: 'public',
    color: meta.color,
    color2: meta.color2,
    icon: meta.icon,
    forked_from: null,
    official: true,
    updated_at: now,
  });
  if (res.error) return;
  // Se reemplazan los juegos (así no choca si cambia el orden).
  await client.from('list_items').delete().eq('list_id', listId);
  await client.from('list_items').insert(
    games.map((g, position) => ({
      id: `${listId}-${position}`,
      list_id: listId,
      game_id: g.id,
      position,
      added_at: now,
    })),
  );
}

// Al abrir la app como administrador: publica las que falten con lo que ya tiene el móvil.
export async function publishMissingOfficial(): Promise<void> {
  const client = getSupabase();
  if (!client || !(await isAdmin())) return;
  const { data } = await client.from('lists').select('id').eq('official', true);
  const published = new Set(((data as { id: string }[] | null) ?? []).map((r) => r.id));
  const state = useStore.getState();
  for (const l of OFFICIAL_LISTS) {
    if (published.has(l.id)) continue;
    const games = Object.values(state.items)
      .filter((i) => i.listId === l.id)
      .sort((a, b) => a.position - b.position)
      .map((i) => state.games[i.gameId])
      .filter((g): g is GameRecord => !!g);
    if (games.length) await publishOfficial(l.id, games).catch(() => undefined);
  }
}
