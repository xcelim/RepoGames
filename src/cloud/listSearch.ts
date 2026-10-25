// Buscar listas públicas por nombre (de cualquier usuario) y las oficiales.
import { OFFICIAL_LISTS } from '@/data/catalog';
import type { GameList } from '@/types';
import { rankByQuery } from '@/utils/fuzzy';

import {
  fromGameRow,
  fromItemRow,
  fromListRow,
  fromProfileRow,
  type GameRow,
  type ListItemRow,
  type ListRow,
  type ProfileRow,
} from './mappers';
import { useRemote } from './remote';
import { getSupabase } from './supabase';

export async function searchPublicLists(q: string): Promise<GameList[]> {
  const text = q.trim();
  if (text.length < 2) return [];
  const official = rankByQuery(text, OFFICIAL_LISTS, (l) => l.name);
  const client = getSupabase();
  if (!client) return official;
  const pattern = `%${text.replace(/[%_,()]/g, ' ')}%`;
  const { data, error } = await client
    .from('lists')
    .select('*')
    .eq('visibility', 'public')
    .eq('official', false)
    .or(`name.ilike.${pattern},description.ilike.${pattern}`)
    .order('updated_at', { ascending: false })
    .limit(40);
  if (error) return official;
  const rows = (data as ListRow[]) ?? [];
  const ids = rows.map((r) => r.id);
  const owners = [...new Set(rows.map((r) => r.owner_id).filter((x): x is string => !!x))];
  const [items, profiles] = await Promise.all([
    ids.length ? client.from('list_items').select('*').in('list_id', ids) : Promise.resolve({ data: [] }),
    owners.length ? client.from('profiles').select('*').in('id', owners) : Promise.resolve({ data: [] }),
  ]);
  const itemRows = (items.data as ListItemRow[] | null) ?? [];
  const gameIds = [...new Set(itemRows.map((i) => i.game_id))].slice(0, 600);
  const games = gameIds.length ? await client.from('games').select('*').in('id', gameIds) : { data: [] };
  const remote = useRemote.getState();
  remote.setData({
    lists: { ...remote.lists, ...Object.fromEntries(rows.map((r) => [r.id, fromListRow(r)])) },
    items: { ...remote.items, ...Object.fromEntries(itemRows.map((r) => [r.id, fromItemRow(r)])) },
    profiles: {
      ...remote.profiles,
      ...Object.fromEntries(((profiles.data as ProfileRow[] | null) ?? []).map((r) => [r.id, fromProfileRow(r)])),
    },
    games: {
      ...remote.games,
      ...Object.fromEntries(((games.data as GameRow[] | null) ?? []).map((r) => [r.id, fromGameRow(r)])),
    },
  });
  return [...official, ...rows.map((r) => fromListRow(r))];
}
