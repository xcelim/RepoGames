import { useStore } from '@/store/useStore';
import type { GameList, GameRecord, ListItem, UserGame } from '@/types';
import { now } from '@/utils/id';

import {
  fromGameRow,
  fromItemRow,
  fromListRow,
  fromProfileRow,
  fromUserGameRow,
  toGameRow,
  toItemRow,
  toListRow,
  toProfileRow,
  toUserGameRow,
  type GameRow,
  type ListItemRow,
  type ListRow,
  type ProfileRow,
  type UserGameRow,
} from './mappers';
import { useRemote } from './remote';
import { getSupabase } from './supabase';

function requireClient() {
  const client = getSupabase();
  if (!client) throw new Error('Configura primero la URL y la clave de Supabase en Ajustes.');
  return client;
}

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// ---------- Cuenta ----------

export async function signUp(email: string, password: string): Promise<string> {
  const client = requireClient();
  const profile = currentProfile();
  const data = check(
    await client.auth.signUp({
      email,
      password,
      options: { data: { username: profile.username, display_name: profile.displayName } },
    }),
  );
  if (!data.user) throw new Error('No se pudo crear la cuenta');
  if (!data.session) {
    throw new Error('Cuenta creada. Confirma el correo que te ha llegado y luego inicia sesión.');
  }
  useStore.getState().setCloud(data.user.id);
  return data.user.id;
}

export async function signIn(email: string, password: string): Promise<string> {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(error?.message ?? 'No se pudo iniciar sesión');
  useStore.getState().setCloud(data.user.id);
  return data.user.id;
}

export async function signOutCloud(): Promise<void> {
  const client = getSupabase();
  if (client) await client.auth.signOut();
  useStore.getState().setCloud(null, null);
}

function currentProfile() {
  const state = useStore.getState();
  const profile = state.currentProfileId ? state.profiles[state.currentProfileId] : undefined;
  if (!profile) throw new Error('No hay perfil activo');
  return profile;
}

function linked() {
  const state = useStore.getState();
  if (!state.cloudUserId || !state.cloudProfileId) throw new Error('Inicia sesión en la nube primero.');
  if (state.cloudProfileId !== state.currentProfileId) {
    throw new Error('La nube está vinculada a otra cuenta de este móvil. Cámbiate a ella.');
  }
  return { uid: state.cloudUserId, localId: state.cloudProfileId };
}

// ---------- Subir: el móvil manda ----------

export async function pushAll(): Promise<void> {
  const client = requireClient();
  const { uid, localId } = linked();
  const state = useStore.getState();
  const profile = state.profiles[localId];

  const profileResult = await client.from('profiles').upsert(toProfileRow(profile, uid));
  if (profileResult.error) {
    // El nombre de usuario ya lo tiene otra persona: se guarda con un sufijo.
    const row = { ...toProfileRow(profile, uid), username: `${profile.username}-${uid.slice(0, 4)}` };
    check(await client.from('profiles').upsert(row));
  }

  const lists = Object.values(state.lists).filter((l) => l.ownerId === localId);
  const listIds = new Set(lists.map((l) => l.id));
  const items = Object.values(state.items).filter((i) => listIds.has(i.listId));
  const userGames = Object.values(state.userGames).filter((u) => u.profileId === localId);

  // Juegos que usas en tus listas o tu biblioteca.
  const gameIds = new Set([...items.map((i) => i.gameId), ...userGames.map((u) => u.gameId)]);
  const customGames = [...gameIds]
    .filter((id) => state.games[id])
    .map((id) => toGameRow(state.games[id], uid));
  if (customGames.length) check(await client.from('games').upsert(customGames));

  if (lists.length) check(await client.from('lists').upsert(lists.map((l) => toListRow(l, uid))));
  if (items.length) check(await client.from('list_items').upsert(items.map(toItemRow)));
  if (userGames.length) {
    check(await client.from('user_games').upsert(userGames.map((u) => toUserGameRow(u, uid))));
  }

  // Borrar en la nube lo que ya no existe en el móvil.
  const remoteLists = check(await client.from('lists').select('id').eq('owner_id', uid)) as { id: string }[];
  const goneLists = remoteLists.map((r) => r.id).filter((id) => !listIds.has(id));
  if (goneLists.length) check(await client.from('lists').delete().in('id', goneLists));

  if (listIds.size) {
    const remoteItems = check(
      await client.from('list_items').select('id').in('list_id', [...listIds]),
    ) as { id: string }[];
    const localItemIds = new Set(items.map((i) => i.id));
    const goneItems = remoteItems.map((r) => r.id).filter((id) => !localItemIds.has(id));
    if (goneItems.length) check(await client.from('list_items').delete().in('id', goneItems));
  }

  const remoteGames = check(
    await client.from('user_games').select('game_id').eq('profile_id', uid),
  ) as { game_id: string }[];
  const localGames = new Set(userGames.map((u) => u.gameId));
  const goneGames = remoteGames.map((r) => r.game_id).filter((id) => !localGames.has(id));
  if (goneGames.length) {
    check(await client.from('user_games').delete().eq('profile_id', uid).in('game_id', goneGames));
  }

  const follows = state.follows[localId] ?? [];
  check(await client.from('list_follows').delete().eq('profile_id', uid));
  if (follows.length) {
    check(
      await client
        .from('list_follows')
        .insert(follows.map((list_id) => ({ profile_id: uid, list_id }))),
    );
  }

  useStore.getState().setCloud(uid, now());
}

// ---------- Bajar: la nube manda (por ejemplo, en un móvil nuevo) ----------

export async function pullAll(): Promise<void> {
  const client = requireClient();
  const { uid, localId } = linked();

  const profileRow = check(
    await client.from('profiles').select('*').eq('id', uid).maybeSingle(),
  ) as ProfileRow | null;
  const listRows = check(await client.from('lists').select('*').eq('owner_id', uid)) as ListRow[];
  const listIds = listRows.map((l) => l.id);
  const itemRows = listIds.length
    ? (check(await client.from('list_items').select('*').in('list_id', listIds)) as ListItemRow[])
    : [];
  const userRows = check(
    await client.from('user_games').select('*').eq('profile_id', uid),
  ) as UserGameRow[];
  const followRows = check(
    await client.from('list_follows').select('list_id').eq('profile_id', uid),
  ) as { list_id: string }[];

  const neededGames = [
    ...new Set([...itemRows.map((i) => i.game_id), ...userRows.map((u) => u.game_id)]),
  ];
  const gameRows = neededGames.length
    ? (check(await client.from('games').select('*').in('id', neededGames)) as GameRow[])
    : [];

  const state = useStore.getState();
  const lists: Record<string, GameList> = Object.fromEntries(
    Object.entries(state.lists).filter(([, l]) => l.ownerId !== localId),
  );
  for (const row of listRows) lists[row.id] = fromListRow(row, localId);
  const keepItems = new Set(Object.keys(lists));
  const items: Record<string, ListItem> = Object.fromEntries(
    Object.entries(state.items).filter(([, i]) => keepItems.has(i.listId) && !listIds.includes(i.listId)),
  );
  for (const row of itemRows) items[row.id] = fromItemRow(row);
  const userGames: Record<string, UserGame> = Object.fromEntries(
    Object.entries(state.userGames).filter(([, u]) => u.profileId !== localId),
  );
  for (const row of userRows) {
    const ug = fromUserGameRow(row, localId);
    userGames[ug.id] = ug;
  }
  const games: Record<string, GameRecord> = { ...state.games };
  for (const row of gameRows) games[row.id] = fromGameRow(row);

  const profiles = { ...state.profiles };
  if (profileRow) profiles[localId] = { ...fromProfileRow(profileRow), id: localId };

  state.importSnapshot({
    profiles,
    lists,
    items,
    userGames,
    games,
    follows: { ...state.follows, [localId]: followRows.map((f) => f.list_id) },
  });
  useStore.getState().setCloud(uid, now());
}

// ---------- Listas públicas de toda la comunidad ----------

export async function fetchCommunity(): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const remote = useRemote.getState();
  remote.setData({ loading: true, error: null });
  try {
    const uid = useStore.getState().cloudUserId;
    let query = client
      .from('lists')
      .select('*')
      .eq('visibility', 'public')
      .eq('official', false)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (uid) query = query.neq('owner_id', uid);
    const listRows = check(await query) as ListRow[];
    const listIds = listRows.map((l) => l.id);
    const ownerIds = [...new Set(listRows.map((l) => l.owner_id).filter((id): id is string => !!id))];
    const itemRows = listIds.length
      ? (check(await client.from('list_items').select('*').in('list_id', listIds)) as ListItemRow[])
      : [];
    const profileRows = ownerIds.length
      ? (check(await client.from('profiles').select('*').in('id', ownerIds)) as ProfileRow[])
      : [];
    const gameIds = [...new Set(itemRows.map((i) => i.game_id))];
    const gameRows = gameIds.length
      ? (check(await client.from('games').select('*').in('id', gameIds)) as GameRow[])
      : [];

    remote.setData({
      lists: Object.fromEntries(listRows.map((r) => [r.id, fromListRow(r)])),
      items: Object.fromEntries(itemRows.map((r) => [r.id, fromItemRow(r)])),
      profiles: Object.fromEntries(profileRows.map((r) => [r.id, fromProfileRow(r)])),
      games: Object.fromEntries(gameRows.map((r) => [r.id, fromGameRow(r)])),
      loading: false,
    });
  } catch (error) {
    remote.setData({ loading: false, error: error instanceof Error ? error.message : 'Error' });
  }
}
