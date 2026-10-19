import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { OFFICIAL_LISTS } from '@/data/catalog';
import type {
  DurationMode,
  GameList,
  GameRecord,
  ListItem,
  PlayStatus,
  Profile,
  SkinId,
  UserGame,
  Visibility,
} from '@/types';
import { now, uuid } from '@/utils/id';
import { findList, itemsOfList, moveItem, replayStats, userGameKey } from '@/utils/library';

export type NewList = {
  name: string;
  description?: string;
  visibility?: Visibility;
  color?: string;
  color2?: string;
  icon?: string;
};

type State = {
  // Ajustes del dispositivo
  skin: SkinId;
  durationMode: DurationMode;
  // Cuentas (en local; con Supabase serían usuarios reales)
  profiles: Record<string, Profile>;
  currentProfileId: string | null;
  // Datos
  games: Record<string, GameRecord>; // juegos añadidos desde IGDB o a mano
  userGames: Record<string, UserGame>; // clave: perfil:juego
  lists: Record<string, GameList>;
  items: Record<string, ListItem>;
  follows: Record<string, string[]>; // perfil -> listas que sigue
  cloudUserId: string | null; // usuario de Supabase vinculado
  cloudProfileId: string | null; // perfil local vinculado a ese usuario
  lastSync: string | null;
  cloudUrl: string; // proyecto de Supabase (vacío = solo en el móvil)
  cloudAnonKey: string;
  officialLoadedAt: Record<string, string>; // cuándo se descargó cada biblioteca oficial
  pendingSeeds: string[]; // copias tuyas de bibliotecas oficiales que esperan a la descarga
  // ---- Nube ----
  cloudEmail: string | null;
  // Cambios hechos en el móvil que aún no están en Supabase: "tabla|clave" -> cuándo.
  dirty: Record<string, number>;
  // Perfil descargado para usarlo sin conexión (opcional, se puede borrar).
  offlineEnabled: boolean;
  downloadedAt: string | null;
};

type Actions = {
  setSkin: (skin: SkinId) => void;
  setDurationMode: (mode: DurationMode) => void;

  createProfile: (data: { displayName: string; username: string; avatarColor: string }) => string;
  switchProfile: (profileId: string) => void;
  updateProfile: (patch: Partial<Omit<Profile, 'id' | 'createdAt'>>) => void;
  deleteProfile: (profileId: string) => void;
  signOut: () => void;

  upsertGame: (game: GameRecord) => void;
  patchGames: (patches: (Partial<GameRecord> & { id: string })[]) => void;
  setStatus: (gameId: string, status: PlayStatus) => void;
  updateUserGame: (gameId: string, patch: Partial<UserGame>) => void;
  removeFromLibrary: (gameId: string) => void;

  createList: (data: NewList) => string;
  updateList: (listId: string, patch: Partial<NewList>) => void;
  deleteList: (listId: string) => void;
  forkList: (listId: string) => string | null;
  toggleFollow: (listId: string) => void;
  addToList: (listId: string, gameId: string) => boolean;
  removeFromList: (listId: string, gameId: string) => void;
  moveInList: (listId: string, from: number, to: number) => void;
  updateListItem: (listId: string, gameId: string, patch: Pick<ListItem, 'note' | 'replays'>) => void;
  setReplayTotal: (gameId: string, total: number) => void;

  importSnapshot: (data: Partial<State>) => void;
  setCloud: (cloudUserId: string | null, lastSync?: string | null) => void;
  setCloudConfig: (url: string, anonKey: string) => void;
  setOfficialList: (listId: string, games: GameRecord[]) => void;
  resetAll: () => void;

  // ---- Nube ----
  seedOfficialCopies: (profileId: string) => void;
  adoptAccount: (uid: string, email: string | null, profile: Profile) => void;
  setOffline: (enabled: boolean, downloadedAt?: string | null) => void;
  clearLocalData: () => void;
};

export type Store = State & Actions;

const INITIAL: State = {
  skin: 'neon',
  durationMode: 'main',
  profiles: {},
  currentProfileId: null,
  games: {},
  userGames: {},
  lists: {},
  items: {},
  follows: {},
  cloudUserId: null,
  cloudProfileId: null,
  lastSync: null,
  cloudUrl: '',
  cloudAnonKey: '',
  officialLoadedAt: {},
  pendingSeeds: [],
  cloudEmail: null,
  dirty: {},
  offlineEnabled: false,
  downloadedAt: null,
};

// Copia una lista (y sus juegos) a otro perfil.
function copyList(
  state: State,
  sourceId: string,
  ownerId: string,
  overrides: Partial<GameList> = {},
): { list: GameList; items: ListItem[] } | null {
  const source = findList(state.lists, sourceId);
  if (!source) return null;
  const stamp = now();
  const list: GameList = {
    ...source,
    id: uuid(),
    ownerId,
    official: false,
    forkedFrom: source.id,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  };
  const items = itemsOfList(state.items, source.id).map((item, position) => ({
    id: uuid(),
    listId: list.id,
    gameId: item.gameId,
    position,
    addedAt: stamp,
  }));
  return { list, items };
}

function withoutKeys<T>(record: Record<string, T>, keep: (value: T) => boolean) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => keep(value)));
}

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const requireProfile = () => {
        const id = get().currentProfileId;
        if (!id) throw new Error('No hay ningún perfil activo');
        return id;
      };

      const touchList = (listId: string) => {
        const list = get().lists[listId];
        if (list) set({ lists: { ...get().lists, [listId]: { ...list, updatedAt: now() } } });
      };

      return {
        ...INITIAL,

        setSkin: (skin) => set({ skin }),
        setDurationMode: (durationMode) => set({ durationMode }),

        createProfile: ({ displayName, username, avatarColor }) => {
          const id = uuid();
          const profile: Profile = {
            id,
            displayName: displayName.trim(),
            username: username.trim().toLowerCase(),
            bio: '',
            avatarColor,
            createdAt: now(),
          };
          set({ profiles: { ...get().profiles, [id]: profile }, currentProfileId: id });
          get().seedOfficialCopies(id);
          return id;
        },

        switchProfile: (profileId) => set({ currentProfileId: profileId }),

        updateProfile: (patch) => {
          const id = requireProfile();
          const profile = get().profiles[id];
          set({ profiles: { ...get().profiles, [id]: { ...profile, ...patch } } });
        },

        deleteProfile: (profileId) => {
          const state = get();
          const listIds = new Set(
            Object.values(state.lists)
              .filter((list) => list.ownerId === profileId)
              .map((list) => list.id),
          );
          const profiles = { ...state.profiles };
          delete profiles[profileId];
          const follows = { ...state.follows };
          delete follows[profileId];
          set({
            profiles,
            follows,
            currentProfileId:
              state.currentProfileId === profileId
                ? (Object.keys(profiles)[0] ?? null)
                : state.currentProfileId,
            lists: withoutKeys(state.lists, (list) => list.ownerId !== profileId),
            items: withoutKeys(state.items, (item) => !listIds.has(item.listId)),
            userGames: withoutKeys(state.userGames, (entry) => entry.profileId !== profileId),
          });
        },

        signOut: () => set({ currentProfileId: null }),

        upsertGame: (game) => set({ games: { ...get().games, [game.id]: game } }),

        patchGames: (patches) => {
          if (!patches.length) return;
          const games = { ...get().games };
          for (const patch of patches) {
            if (games[patch.id]) games[patch.id] = { ...games[patch.id], ...patch };
          }
          set({ games });
        },

        setStatus: (gameId, status) => {
          const profileId = requireProfile();
          const key = userGameKey(profileId, gameId);
          const existing = get().userGames[key];
          const stamp = now();
          const today = stamp.slice(0, 10);
          const base: UserGame = existing ?? {
            id: key,
            profileId,
            gameId,
            status,
            rating: null,
            platform: null,
            liked: [],
            disliked: [],
            review: '',
            hoursPlayed: null,
            startedAt: null,
            finishedAt: null,
            owned: false,
            favorite: false,
            addedAt: stamp,
            updatedAt: stamp,
          };
          const next: UserGame = { ...base, status, updatedAt: stamp };
          if (status === 'playing' && !next.startedAt) next.startedAt = today;
          if ((status === 'beaten' || status === 'completed') && !next.finishedAt) {
            next.finishedAt = today;
          }
          set({ userGames: { ...get().userGames, [key]: next } });
        },

        updateUserGame: (gameId, patch) => {
          const profileId = requireProfile();
          const key = userGameKey(profileId, gameId);
          if (!get().userGames[key]) get().setStatus(gameId, 'library');
          const current = get().userGames[key];
          set({
            userGames: {
              ...get().userGames,
              [key]: { ...current, ...patch, id: key, profileId, gameId, updatedAt: now() },
            },
          });
        },

        removeFromLibrary: (gameId) => {
          const key = userGameKey(requireProfile(), gameId);
          const userGames = { ...get().userGames };
          delete userGames[key];
          set({ userGames });
        },

        createList: (data) => {
          const ownerId = requireProfile();
          const stamp = now();
          const list: GameList = {
            id: uuid(),
            ownerId,
            name: data.name.trim() || 'Nueva biblioteca',
            description: data.description?.trim() ?? '',
            visibility: data.visibility ?? 'private',
            color: data.color ?? '#7b2ff7',
            color2: data.color2 ?? '#f107a3',
            icon: data.icon ?? 'albums',
            forkedFrom: null,
            official: false,
            createdAt: stamp,
            updatedAt: stamp,
          };
          set({ lists: { ...get().lists, [list.id]: list } });
          return list.id;
        },

        updateList: (listId, patch) => {
          const list = get().lists[listId];
          if (!list) return;
          const clean = Object.fromEntries(
            Object.entries(patch).filter(([, value]) => value !== undefined),
          );
          set({ lists: { ...get().lists, [listId]: { ...list, ...clean, updatedAt: now() } } });
        },

        deleteList: (listId) => {
          const state = get();
          const lists = { ...state.lists };
          delete lists[listId];
          set({ lists, items: withoutKeys(state.items, (item) => item.listId !== listId) });
        },

        forkList: (listId) => {
          const ownerId = requireProfile();
          const copy = copyList(get(), listId, ownerId, { visibility: 'private' });
          if (!copy) return null;
          const items = { ...get().items };
          for (const item of copy.items) items[item.id] = item;
          set({ lists: { ...get().lists, [copy.list.id]: copy.list }, items });
          return copy.list.id;
        },

        toggleFollow: (listId) => {
          const profileId = requireProfile();
          const current = get().follows[profileId] ?? [];
          const next = current.includes(listId)
            ? current.filter((id) => id !== listId)
            : [...current, listId];
          set({ follows: { ...get().follows, [profileId]: next } });
        },

        addToList: (listId, gameId) => {
          const existing = itemsOfList(get().items, listId);
          if (existing.some((item) => item.gameId === gameId)) return false;
          const item: ListItem = {
            id: uuid(),
            listId,
            gameId,
            position: existing.length,
            addedAt: now(),
          };
          set({ items: { ...get().items, [item.id]: item } });
          touchList(listId);
          return true;
        },

        removeFromList: (listId, gameId) => {
          const remaining = itemsOfList(get().items, listId).filter(
            (item) => item.gameId !== gameId,
          );
          const items = withoutKeys(get().items, (item) => item.listId !== listId);
          remaining.forEach((item, position) => {
            items[item.id] = { ...item, position };
          });
          set({ items });
          touchList(listId);
        },

        updateListItem: (listId, gameId, patch) => {
          const item = itemsOfList(get().items, listId).find((i) => i.gameId === gameId);
          if (!item) return;
          const next: ListItem = { ...item, ...patch };
          if (next.replays !== undefined) next.replays = Math.max(0, Math.round(next.replays));
          set({ items: { ...get().items, [item.id]: next } });
          touchList(listId);
        },

        // Total de rejugadas = suma de las listas + un ajuste propio (para años sin lista).
        setReplayTotal: (gameId, total) => {
          const profileId = requireProfile();
          const { fromLists } = replayStats(get(), profileId, gameId);
          get().updateUserGame(gameId, { replaysExtra: Math.max(0, Math.round(total)) - fromLists });
        },

        moveInList: (listId, from, to) => {
          const ordered = moveItem(itemsOfList(get().items, listId), from, to);
          const items = { ...get().items };
          ordered.forEach((item, position) => {
            items[item.id] = { ...item, position };
          });
          set({ items });
          touchList(listId);
        },

        importSnapshot: (data) => set({ ...data }),
        setCloud: (cloudUserId, lastSync) =>
          set({
            cloudUserId,
            cloudProfileId: cloudUserId ? get().currentProfileId : null,
            lastSync: lastSync === undefined ? get().lastSync : lastSync,
          }),
        setOfficialList: (listId, games) => {
          const state = get();
          const stamp = now();
          const gamesMap = { ...state.games };
          for (const game of games) {
            const old = gamesMap[game.id];
            // Lo nuevo manda, pero sin borrar datos que ya teníamos (horas, portada...).
            gamesMap[game.id] = old
              ? (Object.fromEntries(
                  Object.entries(game).map(([k, v]) => [k, v ?? old[k as keyof GameRecord]]),
                ) as GameRecord)
              : game;
          }
          const items = withoutKeys(state.items, (item) => item.listId !== listId);
          games.forEach((game, position) => {
            const id = `${listId}-${position}`;
            items[id] = { id, listId, gameId: game.id, position, addedAt: stamp };
          });
          // Rellena las copias de tus perfiles que estaban esperando.
          const pendingSeeds: string[] = [];
          for (const copyId of state.pendingSeeds) {
            const copy = state.lists[copyId];
            if (!copy) continue;
            if (copy.forkedFrom !== listId) {
              pendingSeeds.push(copyId);
              continue;
            }
            if (Object.values(items).some((i) => i.listId === copyId)) continue;
            games.forEach((game, position) => {
              const id = uuid();
              items[id] = { id, listId: copyId, gameId: game.id, position, addedAt: stamp };
            });
          }
          set({
            games: gamesMap,
            items,
            pendingSeeds,
            officialLoadedAt: { ...state.officialLoadedAt, [listId]: stamp },
          });
        },

        // Las bibliotecas oficiales vienen ya añadidas a cada perfil nuevo.
        seedOfficialCopies: (profileId) => {
          const state = get();
          const lists = { ...state.lists };
          const items = { ...state.items };
          const pending = [...state.pendingSeeds];
          const base = Date.now();
          for (const [index, official] of OFFICIAL_LISTS.entries()) {
            // Fechas escalonadas para que salgan en el mismo orden que las oficiales.
            const stamp = new Date(base - index * 1000).toISOString();
            const copy = copyList(state, official.id, profileId, { createdAt: stamp, updatedAt: stamp });
            if (!copy) continue;
            lists[copy.list.id] = copy.list;
            for (const item of copy.items) items[item.id] = item;
            // Si aún no se ha descargado, se rellenará en cuanto llegue.
            if (copy.items.length === 0) pending.push(copy.list.id);
          }
          set({ lists, items, pendingSeeds: pending });
        },

        // Al entrar con una cuenta: los datos del perfil de este móvil pasan a ser de esa cuenta.
        adoptAccount: (uid, email, profile) => {
          const state = get();
          const oldId = state.currentProfileId;
          const rekey = oldId && oldId !== uid && !state.cloudUserId;
          const lists = Object.fromEntries(
            Object.entries(state.lists).map(([k, l]) => [k, rekey && l.ownerId === oldId ? { ...l, ownerId: uid } : l]),
          );
          const userGames: Record<string, UserGame> = {};
          for (const ug of Object.values(state.userGames)) {
            const owner = rekey && ug.profileId === oldId ? uid : ug.profileId;
            const key = userGameKey(owner, ug.gameId);
            userGames[key] = { ...ug, id: key, profileId: owner };
          }
          const follows = { ...state.follows };
          if (rekey && oldId) {
            follows[uid] = [...new Set([...(follows[uid] ?? []), ...(follows[oldId] ?? [])])];
            delete follows[oldId];
          }
          const profiles = { ...state.profiles };
          if (rekey && oldId) delete profiles[oldId];
          profiles[uid] = profile;
          set({
            profiles,
            lists,
            userGames,
            follows,
            currentProfileId: uid,
            cloudUserId: uid,
            cloudProfileId: uid,
            cloudEmail: email,
          });
        },

        setOffline: (offlineEnabled, downloadedAt) =>
          set({ offlineEnabled, downloadedAt: downloadedAt === undefined ? get().downloadedAt : downloadedAt }),

        // Cerrar sesión: se borra todo lo del usuario del móvil (sigue en Supabase).
        clearLocalData: () =>
          set({
            ...INITIAL,
            skin: get().skin,
            durationMode: get().durationMode,
            officialLoadedAt: {},
          }),

        setCloudConfig: (cloudUrl, cloudAnonKey) =>
          set({ cloudUrl: cloudUrl.trim(), cloudAnonKey: cloudAnonKey.trim() }),
        resetAll: () =>
          set({ ...INITIAL, skin: get().skin, cloudUrl: get().cloudUrl, cloudAnonKey: get().cloudAnonKey }),
      };
    },
    {
      name: 'saga-quest-v2',
      version: 4,
      migrate: (persisted, version) => {
        let state = persisted as State;
        // v1 traía un catálogo escrito a mano; v2 descargaba la serie entera. Desde v3 las
        // bibliotecas oficiales son solo los canónicos en su mejor versión: se vuelven a descargar.
        if (version < 3) {
          const officialCopies = Object.values(state.lists ?? {}).filter(
            (l) => l.forkedFrom?.startsWith('official-') && (version < 2 || l.updatedAt === l.createdAt),
          );
          const reset = new Set(officialCopies.map((l) => l.id));
          state = {
            ...state,
            items: withoutKeys(
              state.items ?? {},
              (item) => !item.listId.startsWith('official-') && !reset.has(item.listId),
            ),
            officialLoadedAt: {},
            pendingSeeds: [...new Set([...(state.pendingSeeds ?? []), ...reset])],
          };
        }
        // v4: las fichas guardan desarrolladora, fecha y nota de la crítica (para las
        // pantallas estilo IGN): se vuelven a descargar las bibliotecas oficiales.
        if (version < 4) state = { ...state, officialLoadedAt: {} };
        return state;
      },
      storage: createJSONStorage(() => AsyncStorage),
      // Sin la descarga para usar sin conexión, en el móvil solo se guardan los ajustes,
      // la sesión y los cambios que aún no han llegado a Supabase (para no perderlos).
      partialize: (state) => persistedPart(state),
    },
  ),
);

type Persisted = Partial<State>;

export function persistedPart(state: Store): Persisted {
  const { dirty } = state;
  const data: State = {
    skin: state.skin,
    durationMode: state.durationMode,
    profiles: state.profiles,
    currentProfileId: state.currentProfileId,
    games: state.games,
    userGames: state.userGames,
    lists: state.lists,
    items: state.items,
    follows: state.follows,
    cloudUserId: state.cloudUserId,
    cloudProfileId: state.cloudProfileId,
    lastSync: state.lastSync,
    cloudUrl: state.cloudUrl,
    cloudAnonKey: state.cloudAnonKey,
    officialLoadedAt: state.officialLoadedAt,
    pendingSeeds: state.pendingSeeds,
    cloudEmail: state.cloudEmail,
    dirty,
    offlineEnabled: state.offlineEnabled,
    downloadedAt: state.downloadedAt,
  };
  // Sin cuenta (solo en el móvil) o con la descarga activada: se guarda todo.
  if (!state.cloudUserId || state.offlineEnabled) return data;
  const pick = <T>(table: string, record: Record<string, T>, keyOf: (k: string, v: T) => string) =>
    Object.fromEntries(Object.entries(record).filter(([k, v]) => dirty[`${table}|${keyOf(k, v)}`] !== undefined));
  // Las bibliotecas oficiales son un catálogo común (no datos tuyos): se guardan siempre
  // para no tener que volver a pedirlas a la API cada vez que abres la app.
  const items = {
    ...pick('list_items', state.items, (k) => k),
    ...Object.fromEntries(Object.entries(state.items).filter(([, i]) => i.listId.startsWith('official-'))),
  };
  const userGames = pick('user_games', state.userGames, (_, v: UserGame) => v.gameId);
  const neededGames = new Set([...Object.values(items).map((i) => i.gameId), ...Object.values(userGames).map((u) => u.gameId)]);
  return {
    ...data,
    profiles: state.currentProfileId && state.profiles[state.currentProfileId]
      ? { [state.currentProfileId]: state.profiles[state.currentProfileId] }
      : {},
    lists: pick('lists', state.lists, (k) => k),
    items,
    userGames,
    games: Object.fromEntries(Object.entries(state.games).filter(([k]) => neededGames.has(k) || dirty[`games|${k}`] !== undefined)),
  };
}

// ---------- Hooks de lectura ----------

export function useCurrentProfile(): Profile | null {
  return useStore((s) => (s.currentProfileId ? (s.profiles[s.currentProfileId] ?? null) : null));
}
