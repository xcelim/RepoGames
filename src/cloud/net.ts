import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';

// ¿Hay internet? Se detecta solo: al abrir la app y cada vez que cambia la conexión.

type ConnectionState = { online: boolean; checked: boolean };

export const useConnection = create<ConnectionState>()(() => ({ online: true, checked: false }));

function isOnline(state: NetInfoState): boolean {
  // isInternetReachable puede ser null mientras se comprueba: entonces nos fiamos de isConnected.
  return !!state.isConnected && state.isInternetReachable !== false;
}

let started = false;

export function startConnectionWatcher(): () => void {
  if (started) return () => undefined;
  started = true;
  NetInfo.fetch()
    .then((state) => useConnection.setState({ online: isOnline(state), checked: true }))
    .catch(() => useConnection.setState({ checked: true }));
  const unsubscribe = NetInfo.addEventListener((state) => {
    const online = isOnline(state);
    if (online !== useConnection.getState().online || !useConnection.getState().checked) {
      useConnection.setState({ online, checked: true });
    }
  });
  return () => {
    started = false;
    unsubscribe();
  };
}

export const useOnline = () => useConnection((s) => s.online);

// Cuando una petición falla por la red (aunque NetInfo diga que hay conexión).
export function reportNetworkFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (/network request failed|failed to fetch|network error|timeout/i.test(message)) {
    NetInfo.refresh()
      .then((state) => useConnection.setState({ online: isOnline(state) }))
      .catch(() => undefined);
  }
}
