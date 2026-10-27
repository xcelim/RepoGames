// Motor de sincronización: el móvil escribe primero en local y después lo sube a Supabase.
//
//  · Cada cambio tuyo (lista, juego de una lista, estado, nota, perfil, seguir...) se apunta
//    como "pendiente" (tabla|clave). Se guarda en el móvil, así no se pierde aunque se corte
//    la red o se cierre la app a mitad.
//  · Al haber conexión se suben los pendientes. Cada respuesta de Supabase se comprueba
//    ({ data, error }): solo se quita de pendientes lo que de verdad se ha guardado.
//  · Al abrir la app, al volver la conexión o si cambias algo en otro móvil (tiempo real),
//    se descarga lo último de Supabase sin pisar lo que tengas pendiente de subir.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Image } from 'expo-image';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { clearOnlineCache, fetchCover, fetchDetails } from '@/api/games';
import { useStore, type Store } from '@/store/useStore';
import type { GameList, GameRecord, ListItem, UserGame } from '@/types';
import { now } from '@/utils/id';
import { userGameKey } from '@/utils/library';
import { notify } from '@/utils/notify';

import {
  fromGameRow,
  fromItemRow,
  fromListRow,
  fromProfileRow,
  mergeProfileRow,
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
import { reportNetworkFailure, useConnection } from './net';
import { getSupabase } from './supabase';

// ---------- Estado visible (para la interfaz) ----------

type SyncState = {
  status: 'idle' | 'syncing' | 'error';
  error: string | null;
  // Ya se han descargado tus datos en esta sesión (o los tienes descargados en el móvil).
  ready: boolean;
  download: { done: number; total: number } | null;
};

export const useSync = create<SyncState>()(() => ({ status: 'idle', error: null, ready: false, download: null }));

export const pendingCount = (s: Store) => Object.keys(s.dirty).length;

// ---------- Detectar cambios ----------

let applyingRemote = false;

function changedKeys<T>(prev: Record<string, T>, next: Record<string, T>, cb: (key: string, value: T) => void) {
  if (prev === next) return;
  for (const key of Object.keys(next)) if (next[key] !== prev[key]) cb(key, next[key]);
  for (const key of Object.keys(prev)) if (!(key in next)) cb(key, prev[key]);
}

function usedGameIds(s: Store, uid: string): Set<string> {
  const mine = new Set(
    Object.values(s.lists)
      .filter((l) => l.ownerId === uid)
      .map((l) => l.id),
  );
  return new Set([
    ...Object.values(s.items)
      .filter((i) => mine.has(i.listId))
      .map((i) => i.gameId),
    ...Object.values(s.userGames)
      .filter((u) => u.profileId === uid)
      .map((u) => u.gameId),
  ]);
}

export function diffState(prev: Store, next: Store, uid: string): string[] {
  const keys = new Set<string>();
  if (next.profiles[uid] !== prev.profiles[uid] || next.skin !== prev.skin || next.durationMode !== prev.durationMode) {
    if (next.profiles[uid]) {
      keys.add(`profiles|${uid}`);
      // Qué ha cambiado exactamente: al subir solo se pisa eso (lo demás se respeta de la nube,
      // así un dispositivo no deshace lo que has cambiado en otro).
      const a = (prev.profiles[uid] ?? {}) as unknown as Record<string, unknown>;
      const b = next.profiles[uid] as unknown as Record<string, unknown>;
      for (const f of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[f] !== b[f]) keys.add(`profilefield|${f}`);
      if (next.skin !== prev.skin) keys.add('profilefield|skin');
      if (next.durationMode !== prev.durationMode) keys.add('profilefield|durationMode');
    }
  }
  const ownerOf = (listId: string) => (next.lists[listId] ?? prev.lists[listId])?.ownerId;
  changedKeys(prev.lists, next.lists, (key, list: GameList) => {
    if (list.ownerId === uid && !list.official) keys.add(`lists|${key}`);
  });
  // Juegos de tus listas y de las cooperativas en las que estás.
  const canEdit = (listId: string) => {
    const l = next.lists[listId] ?? prev.lists[listId];
    return !!l && (l.ownerId === uid || !!l.members?.includes(uid));
  };
  changedKeys(prev.items, next.items, (key, item: ListItem) => {
    if (ownerOf(item.listId) === uid || canEdit(item.listId)) keys.add(`list_items|${key}`);
  });
  changedKeys(prev.userGames, next.userGames, (_key, ug: UserGame) => {
    if (ug.profileId === uid) keys.add(`user_games|${ug.gameId}`);
  });
  const before = prev.follows[uid] ?? [];
  const after = next.follows[uid] ?? [];
  if (before !== after) {
    for (const id of after) if (!before.includes(id)) keys.add(`list_follows|${id}`);
    for (const id of before) if (!after.includes(id)) keys.add(`list_follows|${id}`);
  }
  // Juegos: solo los que usas (los que has mirado o los de las listas oficiales no se suben).
  if (prev.games !== next.games) {
    let used: Set<string> | null = null;
    changedKeys(prev.games, next.games, (key) => {
      used ??= usedGameIds(next, uid);
      if (used.has(key)) keys.add(`games|${key}`);
    });
  }
  return [...keys];
}

// Marca como pendiente todo lo tuyo (al entrar en una cuenta con datos de este móvil).
export function markAllDirty(uid: string): void {
  const s = useStore.getState();
  const dirty = { ...s.dirty };
  const stamp = Date.now();
  if (s.profiles[uid]) dirty[`profiles|${uid}`] = stamp;
  const mine = new Set<string>();
  for (const l of Object.values(s.lists)) {
    if (l.ownerId === uid && !l.official) {
      dirty[`lists|${l.id}`] = stamp;
      mine.add(l.id);
    }
  }
  for (const i of Object.values(s.items)) if (mine.has(i.listId)) dirty[`list_items|${i.id}`] = stamp;
  for (const u of Object.values(s.userGames)) if (u.profileId === uid) dirty[`user_games|${u.gameId}`] = stamp;
  for (const id of s.follows[uid] ?? []) dirty[`list_follows|${id}`] = stamp;
  useStore.setState({ dirty });
}

// ---------- Subir ----------

function check(result: { error: { message: string; code?: string } | null }, what: string) {
  if (result.error) {
    const error = new Error(`${what}: ${result.error.message}`) as Error & { code?: string };
    error.code = result.error.code;
    throw error;
  }
}

const chunks = <T>(list: T[], size = 200): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

// Las subidas van en fila: si llega una mientras otra está en marcha, espera su turno
// (así nunca se pierde un cambio hecho durante una subida).
let flushQueue: Promise<void> = Promise.resolve();

export function flush(): Promise<void> {
  const run = flushQueue.catch(() => undefined).then(doFlush);
  flushQueue = run.catch(() => undefined);
  return run;
}

async function doFlush(): Promise<void> {
  const client = getSupabase();
  const state = useStore.getState();
  const uid = state.cloudUserId;
  if (!client || !uid || !useConnection.getState().online) return;
  const snapshot = { ...state.dirty };
  const entries = Object.keys(snapshot);
  if (!entries.length) return;

  const byTable: Record<string, string[]> = {};
  for (const entry of entries) {
    const [table, key] = entry.split('|');
    (byTable[table] ??= []).push(key);
  }
  const done: string[] = [];
  const errors: string[] = [];
  const step = async (table: string, keys: string[], fn: () => Promise<void>) => {
    if (!keys.length) return;
    try {
      await fn();
      done.push(...keys.map((k) => `${table}|${k}`));
    } catch (error) {
      // Un fallo en una tabla no impide subir las demás.
      errors.push(error instanceof Error ? error.message : String(error));
    }
  };

  const myListIds = new Set(
    Object.values(state.lists)
      .filter((l) => l.ownerId === uid)
      .map((l) => l.id),
  );
  const myItems = Object.values(state.items).filter((i) => myListIds.has(i.listId));
  const myUserGames = Object.values(state.userGames).filter((u) => u.profileId === uid);
  const used = new Set([...myItems.map((i) => i.gameId), ...myUserGames.map((u) => u.gameId)]);

  // 1. Perfil y ajustes
  if (byTable.profiles?.includes(uid) && state.profiles[uid]) {
    await step('profiles', [uid], async () => {
      const local = toProfileRow(state.profiles[uid], uid, { skin: state.skin, durationMode: state.durationMode });
      const fields = new Set(byTable.profilefield ?? []);
      let row = local;
      if (fields.size) {
        const remote = (await client.from('profiles').select('*').eq('id', uid).maybeSingle())
          .data as ProfileRow | null;
        if (remote) row = mergeProfileRow(local, remote, fields);
      }
      const first = await client.from('profiles').upsert(row);
      if (first.error?.code === '23505') {
        // Ese nombre de usuario ya lo tiene otra persona: se le añade un sufijo.
        const username = `${row.username.slice(0, 24)}-${uid.slice(0, 4)}`;
        check(await client.from('profiles').upsert({ ...row, username }), 'Perfil');
        applyingRemote = true;
        useStore.setState({
          profiles: { ...useStore.getState().profiles, [uid]: { ...state.profiles[uid], username } },
        });
        applyingRemote = false;
      } else check(first, 'Perfil');
      done.push(...(byTable.profilefield ?? []).map((f) => `profilefield|${f}`));
    });
  }

  // 2. Juegos que usan tus listas y tu biblioteca (antes que lo que los referencia).
  const dirtyItems = (byTable.list_items ?? []).map((k) => state.items[k]).filter(Boolean);
  const dirtyUserGames = (byTable.user_games ?? []).map((g) => state.userGames[userGameKey(uid, g)]).filter(Boolean);
  const gameIds = new Set([
    ...(byTable.games ?? []).filter((id) => used.has(id)),
    ...dirtyItems.map((i) => i.gameId),
    ...dirtyUserGames.map((u) => u.gameId),
  ]);
  const gameRows = [...gameIds]
    .map((id) => state.games[id])
    .filter(Boolean)
    .map((g) => toGameRow(g, uid));
  try {
    for (const part of chunks(gameRows)) {
      const res = await client.from('games').upsert(part);
      if (!res.error) continue;
      // Uno a uno, para que un juego raro no bloquee a los demás.
      const bad: string[] = [];
      for (const row of part) if ((await client.from('games').upsert(row)).error) bad.push(row.title);
      if (bad.length)
        throw new Error(`Juegos: no se han podido guardar ${bad.slice(0, 3).join(', ')}: ${res.error.message}`);
    }
    // Los juegos que solo has mirado (no están en tus listas ni tu biblioteca) no se suben.
    done.push(...(byTable.games ?? []).map((k) => `games|${k}`));
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  // 3. Listas nuevas o cambiadas
  const listKeys = byTable.lists ?? [];
  const listsUp = listKeys.filter((k) => state.lists[k]);
  const listsDown = listKeys.filter((k) => !state.lists[k]);
  await step('lists', listsUp, async () => {
    check(await client.from('lists').upsert(listsUp.map((k) => toListRow(state.lists[k], uid))), 'Listas');
  });

  // 4. Juegos de las listas: primero lo borrado (por si un juego se quitó y se volvió a poner).
  const itemKeys = byTable.list_items ?? [];
  const itemsDown = itemKeys.filter((k) => !state.items[k]);
  const itemsUp = itemKeys.filter((k) => state.items[k]);
  await step('list_items', itemsDown, async () => {
    for (const part of chunks(itemsDown))
      check(await client.from('list_items').delete().in('id', part), 'Quitar de listas');
  });
  await step('list_items', itemsUp, async () => {
    for (const part of chunks(itemsUp)) {
      check(await client.from('list_items').upsert(part.map((k) => toItemRow(state.items[k]))), 'Juegos de las listas');
    }
  });

  // 5. Biblioteca (estado, nota, reseña...)
  const ugKeys = byTable.user_games ?? [];
  const ugUp = ugKeys.filter((g) => state.userGames[userGameKey(uid, g)]);
  const ugDown = ugKeys.filter((g) => !state.userGames[userGameKey(uid, g)]);
  // Se sube por tandas; si una tanda falla, se prueba juego a juego para que un juego con
  // problemas no deje sin subir a todos los demás (lo que falla se queda pendiente).
  if (ugUp.length) {
    const upsert = async (keys: string[]) => {
      const rows = keys.map((g) => toUserGameRow(state.userGames[userGameKey(uid, g)], uid));
      let res = await client.from('user_games').upsert(rows, { onConflict: 'profile_id,game_id' });
      // Si aún no se ha ejecutado el SQL nuevo, se sube sin la columna que falta.
      if (res.error && /achievements_total/.test(res.error.message))
        res = await client.from('user_games').upsert(
          rows.map(({ achievements_total: _t, ...r }) => r),
          { onConflict: 'profile_id,game_id' },
        );
      return res.error;
    };
    const failed: string[] = [];
    let reason = '';
    for (const part of chunks(ugUp)) {
      const err = await upsert(part).catch((e: unknown) => ({ message: String(e), code: 'net' }));
      if (!err) {
        done.push(...part.map((k) => `user_games|${k}`));
        continue;
      }
      if (err.code === 'net' || /fetch|network|timeout/i.test(err.message)) {
        failed.push(...part);
        reason = err.message;
        continue;
      }
      for (let k = 0; k < part.length; k += 10) {
        const slice = part.slice(k, k + 10);
        const results = await Promise.all(
          slice.map((g) => upsert([g]).catch((e: unknown) => ({ message: String(e) }))),
        );
        results.forEach((e, n) => {
          if (!e) done.push(`user_games|${slice[n]}`);
          else {
            failed.push(slice[n]);
            reason = e.message;
          }
        });
      }
    }
    if (failed.length) {
      const title = (g: string) => state.games[g]?.title ?? g;
      const which = failed.slice(0, 3).map(title).join(', ') + (failed.length > 3 ? ` y ${failed.length - 3} más` : '');
      errors.push(
        /status_check/.test(reason)
          ? `Biblioteca: para guardar juegos «Vistos» falta ejecutar en Supabase el SQL 2026-10-27-visto.sql (${which})`
          : `Biblioteca: no se han podido guardar ${failed.length} juegos (${which}): ${reason}`,
      );
    }
  }
  await step('user_games', ugDown, async () => {
    check(
      await client.from('user_games').delete().eq('profile_id', uid).in('game_id', ugDown),
      'Quitar de la biblioteca',
    );
  });

  // 6. Listas que sigues
  const followKeys = byTable.list_follows ?? [];
  const following = state.follows[uid] ?? [];
  const fUp = followKeys.filter((k) => following.includes(k));
  const fDown = followKeys.filter((k) => !following.includes(k));
  await step('list_follows', fUp, async () => {
    check(
      await client.from('list_follows').upsert(
        fUp.map((list_id) => ({ profile_id: uid, list_id })),
        { onConflict: 'profile_id,list_id', ignoreDuplicates: true },
      ),
      'Seguir listas',
    );
  });
  await step('list_follows', fDown, async () => {
    check(await client.from('list_follows').delete().eq('profile_id', uid).in('list_id', fDown), 'Dejar de seguir');
  });

  // 7. Listas borradas (al final: sus juegos se borran solos en la base de datos).
  await step('lists', listsDown, async () => {
    check(await client.from('lists').delete().in('id', listsDown), 'Borrar listas');
  });

  // Solo se quita de pendientes lo que se subió y no ha vuelto a cambiar mientras tanto.
  const current = useStore.getState().dirty;
  const remaining = { ...current };
  for (const entry of done) if (current[entry] === snapshot[entry]) delete remaining[entry];
  useStore.setState({ dirty: remaining, lastSync: errors.length ? useStore.getState().lastSync : now() });
  if (errors.length) throw new Error(errors.join(' · '));
}

// ---------- Bajar ----------

async function selectIn<T>(table: string, column: string, values: string[]): Promise<T[]> {
  const client = getSupabase()!;
  const out: T[] = [];
  for (const part of chunks(values)) {
    const res = await client.from(table).select('*').in(column, part);
    check(res, table);
    out.push(...((res.data ?? []) as T[]));
  }
  return out;
}

function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

// Devuelve `next`, pero reutilizando los objetos de `prev` que son iguales (y `prev` entero si nada cambió).
export function keepSame<T>(prev: Record<string, T>, next: Record<string, T>): Record<string, T> {
  let changed = Object.keys(prev).length !== Object.keys(next).length;
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(next)) {
    if (k in prev && same(prev[k], v)) out[k] = prev[k];
    else {
      out[k] = v;
      changed = true;
    }
  }
  return changed ? out : prev;
}

export async function pull(): Promise<void> {
  const client = getSupabase();
  const uid = useStore.getState().cloudUserId;
  if (!client || !uid) return;

  const profileRes = await client.from('profiles').select('*').eq('id', uid).maybeSingle();
  check(profileRes, 'Perfil');
  const listRes = await client.from('lists').select('*').eq('owner_id', uid);
  check(listRes, 'Listas');
  const ownRows = (listRes.data ?? []) as ListRow[];
  // Listas cooperativas en las que estás y listas que sigues (las del autor, en vivo).
  const memberRes = await client.from('list_members').select('list_id').eq('profile_id', uid);
  const memberIds = memberRes.error ? [] : ((memberRes.data ?? []) as { list_id: string }[]).map((r) => r.list_id);
  const followPre = await client.from('list_follows').select('list_id').eq('profile_id', uid);
  const followIds = ((followPre.data ?? []) as { list_id: string }[]).map((r) => r.list_id);
  const otherIds = [...new Set([...memberIds, ...followIds])].filter((id) => !ownRows.some((l) => l.id === id));
  // Las oficiales que sigues ya están en la app (catálogo): aquí solo cuenta que las sigues.
  const otherRows = (await selectIn<ListRow>('lists', 'id', otherIds)).filter((r) => !r.official && r.owner_id);
  const listRows = [...ownRows, ...otherRows];
  const itemRows = await selectIn<ListItemRow>(
    'list_items',
    'list_id',
    listRows.map((l) => l.id),
  );
  // Quién está en cada lista cooperativa (si aún no se ha ejecutado el SQL, ninguna lo es).
  const memberRows = memberRes.error
    ? []
    : await selectIn<{ list_id: string; profile_id: string }>(
        'list_members',
        'list_id',
        listRows.map((l) => l.id),
      );
  const membersOf = new Map<string, string[]>();
  for (const m of memberRows) membersOf.set(m.list_id, [...(membersOf.get(m.list_id) ?? []), m.profile_id]);
  const ugRes = await client.from('user_games').select('*').eq('profile_id', uid);
  check(ugRes, 'Biblioteca');
  const ugRows = (ugRes.data ?? []) as UserGameRow[];
  const followRes = await client.from('list_follows').select('list_id').eq('profile_id', uid);
  check(followRes, 'Seguidas');
  const followRows = (followRes.data ?? []) as { list_id: string }[];
  const gameRows = await selectIn<GameRow>('games', 'id', [
    ...new Set([...itemRows.map((i) => i.game_id), ...ugRows.map((u) => u.game_id)]),
  ]);

  // Mezcla: lo de Supabase manda, salvo lo que tienes pendiente de subir.
  const state = useStore.getState();
  const dirty = state.dirty;
  const isDirty = (table: string, key: string) => dirty[`${table}|${key}`] !== undefined;

  const remoteIds = new Set(listRows.map((l) => l.id));
  const lists: Record<string, GameList> = {};
  // Lo de Supabase manda. Las listas ajenas que ya no sigues o de las que te han sacado desaparecen.
  for (const [k, l] of Object.entries(state.lists)) {
    if (l.official || isDirty('lists', k)) lists[k] = l;
    else if (l.ownerId !== uid && !remoteIds.has(k) && isDirty('list_follows', k)) lists[k] = l; // seguida hace un momento
  }
  for (const row of listRows) {
    if (isDirty('lists', row.id)) continue;
    const members = membersOf.get(row.id);
    lists[row.id] = { ...fromListRow(row, row.owner_id ?? uid), ...(members?.length ? { members } : {}) };
  }

  const items: Record<string, ListItem> = {};
  for (const [k, i] of Object.entries(state.items)) {
    if (isDirty('list_items', k)) items[k] = i;
    else if (remoteIds.has(i.listId))
      continue; // vienen de Supabase
    else if (state.lists[i.listId]?.ownerId === uid)
      continue; // lista tuya borrada en otro móvil
    else if (state.lists[i.listId] && !lists[i.listId])
      continue; // lista ajena que ya no tienes
    else items[k] = i; // oficiales y demás
  }
  for (const row of itemRows) if (!isDirty('list_items', row.id)) items[row.id] = fromItemRow(row);

  const userGames: Record<string, UserGame> = {};
  for (const [k, u] of Object.entries(state.userGames))
    if (u.profileId !== uid || isDirty('user_games', u.gameId)) userGames[k] = u;
  for (const row of ugRows) {
    if (isDirty('user_games', row.game_id)) continue;
    const ug = fromUserGameRow(row, uid);
    userGames[ug.id] = ug;
  }

  const localFollows = state.follows[uid] ?? [];
  const follows = new Set(followRows.map((f) => f.list_id));
  for (const entry of Object.keys(dirty)) {
    if (!entry.startsWith('list_follows|')) continue;
    const id = entry.slice('list_follows|'.length);
    if (localFollows.includes(id)) follows.add(id);
    else follows.delete(id);
  }

  const games: Record<string, GameRecord> = { ...state.games };
  for (const row of gameRows) {
    if (isDirty('games', row.id)) continue;
    const remote = fromGameRow(row);
    const local = games[row.id];
    // Sin perder datos que el móvil ya tenía (portada, horas...).
    games[row.id] = local
      ? (Object.fromEntries(
          Object.entries(remote).map(([k, v]) => [k, v ?? local[k as keyof GameRecord]]),
        ) as GameRecord)
      : remote;
  }

  // Lo que no ha cambiado conserva el mismo objeto: así las pantallas no se repintan
  // (ni parpadean las portadas) cada vez que se comprueba si hay novedades.
  const patch: Partial<Store> = {
    lists: keepSame(state.lists, lists),
    items: keepSame(state.items, items),
    userGames: keepSame(state.userGames, userGames),
    games: keepSame(state.games, games),
    follows: keepSame(state.follows, { ...state.follows, [uid]: [...follows] }),
  };
  for (const k of Object.keys(patch) as (keyof typeof patch)[])
    if (patch[k] === (state as Partial<Store>)[k]) delete patch[k];
  const profileRow = profileRes.data as ProfileRow | null;
  if (profileRow && !isDirty('profiles', uid)) {
    const nextProfiles = keepSame(state.profiles, { ...state.profiles, [uid]: fromProfileRow(profileRow) });
    if (nextProfiles !== state.profiles) patch.profiles = nextProfiles;
    const settings = profileRow.settings ?? {};
    if (settings.skin) patch.skin = settings.skin as Store['skin'];
    if (settings.durationMode) patch.durationMode = settings.durationMode as Store['durationMode'];
  }
  applyingRemote = true;
  try {
    useStore.setState(patch);
  } finally {
    applyingRemote = false;
  }

  // Las bibliotecas oficiales (Fire Emblem, Zelda...) ya NO se copian solas a cada cuenta:
  // están en Descubrir y cada uno se añade las que quiera.
}

// ---------- Sincronizar ----------

let syncing: Promise<void> | null = null;

// Si algo no se ha podido guardar en tu cuenta, se avisa (una vez por cada problema distinto).
let lastAnnounced = '';
function announce(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  if (!useConnection.getState().online || /fetch|network|timeout|Failed to/i.test(msg)) return;
  if (msg === lastAnnounced) return;
  lastAnnounced = msg;
  notify(`⚠️ No se ha guardado todo en tu cuenta: ${msg.slice(0, 220)}`);
}

export function syncNow(): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    const state = useStore.getState();
    if (!getSupabase() || !state.cloudUserId) return;
    if (!useConnection.getState().online) return;
    useSync.setState({ status: 'syncing' });
    try {
      // Primero se sube lo pendiente (para que la descarga no lo pise), después se baja.
      await flush().catch((e) => console.warn('Sync: subida incompleta', e));
      await pull();
      await flush();
      useSync.setState({ status: 'idle', error: null, ready: true });
      if (useStore.getState().offlineEnabled) refreshOfflineCopy();
    } catch (error) {
      reportNetworkFailure(error);
      announce(error);
      useSync.setState({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flush()
      .then(() => useSync.setState({ status: 'idle', error: null }))
      .catch((error) => {
        reportNetworkFailure(error);
        announce(error);
        useSync.setState({ status: 'error', error: error instanceof Error ? error.message : String(error) });
      });
  }, 1200);
}

let pullTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePull() {
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = setTimeout(() => {
    syncNow();
  }, 1500);
}

// ---------- Arranque ----------

let channel: RealtimeChannel | null = null;

function subscribeRealtime(uid: string | null) {
  const client = getSupabase();
  if (channel && client) {
    client.removeChannel(channel);
    channel = null;
  }
  if (!client || !uid) return;
  const on = (table: string, filter: string) => ({ event: '*' as const, schema: 'public', table, filter });
  channel = client
    .channel(`sync-${uid}`)
    .on('postgres_changes', on('lists', `owner_id=eq.${uid}`), schedulePull)
    .on('postgres_changes', on('user_games', `profile_id=eq.${uid}`), schedulePull)
    .on('postgres_changes', on('list_follows', `profile_id=eq.${uid}`), schedulePull)
    .on('postgres_changes', on('profiles', `id=eq.${uid}`), schedulePull)
    .subscribe();
}

export function startSyncEngine(): () => void {
  const unsubStore = useStore.subscribe((next, prev) => {
    if (applyingRemote || !next.cloudUserId) return;
    if (next.cloudUserId !== prev.cloudUserId) return; // al entrar o salir de una cuenta
    const keys = diffState(prev, next, next.cloudUserId);
    if (!keys.length) return;
    const stamp = Date.now();
    const dirty = { ...next.dirty };
    for (const key of keys) dirty[key] = stamp;
    useStore.setState({ dirty });
    scheduleFlush();
  });

  let lastUid = useStore.getState().cloudUserId;
  subscribeRealtime(lastUid);
  const unsubUser = useStore.subscribe((s) => {
    if (s.cloudUserId !== lastUid) {
      lastUid = s.cloudUserId;
      subscribeRealtime(lastUid);
    }
  });

  // Al volver la conexión: se sube lo pendiente y se descarga lo último.
  const unsubNet = useConnection.subscribe((s, prev) => {
    if (s.online && !prev.online) syncNow();
  });

  // Al volver a la app (por si cambiaste algo en otro móvil).
  let lastActive = 0;
  const appSub = AppState.addEventListener('change', (state) => {
    if (state === 'active' && Date.now() - lastActive > 30_000) {
      lastActive = Date.now();
      subscribeRealtime(useStore.getState().cloudUserId);
      syncNow();
    }
    // Al irse a segundo plano se intenta subir lo pendiente.
    if (state === 'background') flush().catch(() => undefined);
  });

  if (useStore.getState().offlineEnabled) useSync.setState({ ready: true });
  syncNow();

  // Red de seguridad por si el tiempo real se pierde: se trae lo último cada minuto.
  const poll = setInterval(() => {
    if (AppState.currentState === 'active' && useStore.getState().cloudUserId) syncNow();
  }, 60_000);

  return () => {
    unsubStore();
    unsubUser();
    unsubNet();
    appSub.remove();
    clearInterval(poll);
    subscribeRealtime(null);
  };
}

// ---------- Descarga para usar sin conexión (opcional) ----------

function myGames(): GameRecord[] {
  const s = useStore.getState();
  const uid = s.cloudUserId ?? s.currentProfileId;
  const myLists = new Set(
    Object.values(s.lists)
      .filter((l) => l.ownerId === uid)
      .map((l) => l.id),
  );
  const ids = new Set([
    ...Object.values(s.items)
      .filter((i) => myLists.has(i.listId))
      .map((i) => i.gameId),
    ...Object.values(s.userGames)
      .filter((u) => u.profileId === uid)
      .map((u) => u.gameId),
  ]);
  return [...ids].map((id) => s.games[id]).filter((g): g is GameRecord => !!g);
}

export async function downloadProfile(): Promise<void> {
  if (!useConnection.getState().online) throw new Error('Necesitas conexión para descargar tu perfil.');
  await syncNow();
  if (useSync.getState().status === 'error') throw new Error(useSync.getState().error ?? 'No se pudo sincronizar');
  // A partir de aquí el móvil guarda una copia completa de tus listas y tu biblioteca.
  useStore.getState().setOffline(true);
  const games = myGames();
  useSync.setState({ download: { done: 0, total: games.length } });
  let done = 0;
  for (const game of games) {
    try {
      const details = await fetchDetails(game, 'low');
      const cover = game.coverUrl ?? details?.coverUrl ?? (await fetchCover(game));
      if (cover) await Image.prefetch(cover, 'disk');
    } catch {
      // Si un juego falla, se sigue con los demás.
    }
    done += 1;
    useSync.setState({ download: { done, total: games.length } });
  }
  useStore.getState().setOffline(true, now());
  useSync.setState({ download: null });
}

// Con la descarga activada: guarda también las fichas y portadas de los juegos nuevos.
let refreshing = false;
async function refreshOfflineCopy(): Promise<void> {
  if (refreshing || useSync.getState().download) return;
  refreshing = true;
  try {
    for (const game of myGames()) {
      if (!useStore.getState().offlineEnabled || !useConnection.getState().online) break;
      try {
        const details = await fetchDetails(game, 'low');
        const cover = game.coverUrl ?? details?.coverUrl;
        if (cover) await Image.prefetch(cover, 'disk');
      } catch {
        // se intentará la próxima vez
      }
    }
  } finally {
    refreshing = false;
  }
}

export async function deleteDownload(): Promise<void> {
  useStore.getState().setOffline(false, null);
  await clearOnlineCache();
  await Image.clearDiskCache().catch(() => false);
  // Se vuelve a guardar el estado (ahora solo ajustes y pendientes).
  useStore.setState({});
}

export async function downloadSize(): Promise<{ games: number; bytes: number }> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const keys = await AsyncStorage.getAllKeys();
  const values = await AsyncStorage.multiGet(keys.filter((k) => k.startsWith('details:') || k === 'saga-quest-v2'));
  const text = values.reduce((sum, [, v]) => sum + (v?.length ?? 0), 0);
  const games = myGames().length;
  // Unos 35 KB por portada guardada.
  return { games, bytes: text + (useStore.getState().downloadedAt ? games * 35_000 : 0) };
}
