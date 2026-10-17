import { create } from 'zustand';

import type { GameList, GameRecord, ListItem, Profile } from '@/types';

// Listas públicas de otros usuarios descargadas de Supabase (no se guardan en el móvil).
type RemoteState = {
  profiles: Record<string, Profile>;
  lists: Record<string, GameList>;
  items: Record<string, ListItem>;
  games: Record<string, GameRecord>;
  loading: boolean;
  error: string | null;
  setData: (data: Partial<Omit<RemoteState, 'setData'>>) => void;
};

export const useRemote = create<RemoteState>()((set) => ({
  profiles: {},
  lists: {},
  items: {},
  games: {},
  loading: false,
  error: null,
  setData: (data) => set(data),
}));
