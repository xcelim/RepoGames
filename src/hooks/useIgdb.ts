import { useEffect, useState } from 'react';

import { fetchCover, fetchDetails, fillBasics } from '@/api/games';
import { useStore } from '@/store/useStore';
import type { GameDetails } from '@/api/types';
import type { GameRecord } from '@/types';

// Portada de un juego (de su ficha, de IGDB o de RAWG).
export function useCover(game: GameRecord | undefined): string | null {
  const [url, setUrl] = useState<string | null>(game?.coverUrl ?? null);
  const id = game?.id;
  const known = game?.coverUrl ?? null;
  useEffect(() => {
    if (!game || known) return;
    let cancelled = false;
    fetchCover(game)
      .then((result) => {
        if (!cancelled) setUrl(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, known]);
  return known ?? url;
}

// Ficha completa del juego.
export function useGameDetails(game: GameRecord | undefined) {
  const [state, setState] = useState<{
    id?: string;
    details: GameDetails | null;
    loading: boolean;
    error: string | null;
  }>({
    details: null,
    loading: false,
    error: null,
  });
  const id = game?.id;
  useEffect(() => {
    if (!game) return;
    let cancelled = false;
    fetchDetails(game)
      .then((details) => {
        if (!cancelled) setState({ id: game.id, details, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            id: game.id,
            details: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Error',
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const fresh = state.id === id;
  return { details: fresh ? state.details : null, loading: !fresh, error: fresh ? state.error : null };
}

// Completa en segundo plano desarrolladora, fecha y nota de los juegos que no las tengan.
export function useFillBasics(games: GameRecord[]): void {
  const key = games
    .filter((g) => g.igdbId && g.developer === undefined)
    .map((g) => g.id)
    .join('|');
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const missing = useStore.getState();
    const list = key
      .split('|')
      .map((id) => missing.games[id])
      .filter((g): g is GameRecord => !!g);
    fillBasics(list)
      .then((patches) => {
        if (!cancelled) useStore.getState().patchGames(patches);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [key]);
}
