// Modo sin conexión: se activa solo al perder internet. Solo queda tu perfil
// (tu biblioteca y tus listas, si las descargaste); lo demás se desactiva.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pendingCount, syncNow, useSync } from '@/cloud/engine';
import { useOnline } from '@/cloud/net';
import { isCloudEnabled } from '@/cloud/supabase';
import { useStore } from '@/store/useStore';

import { DarkButton, LightButton, useIgnColors } from './ign';
import { ThemedText } from './ThemedText';
import { goBack } from '@/utils/nav';

export function useOfflineMode(): boolean {
  const online = useOnline();
  return !online;
}

// Pantalla completa de aviso.
export function OfflineNotice({
  title,
  text,
  icon = 'cloud-offline-outline',
  children,
}: {
  title: string;
  text: string;
  icon?: 'cloud-offline-outline' | 'download-outline' | 'alert-circle-outline';
  children?: ReactNode;
}) {
  const c = useIgnColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.full, { backgroundColor: c.bg, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
    >
      <Ionicons name={icon} size={64} color={c.muted} />
      <ThemedText variant="display" size={24} style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText variant="muted" size={14} style={styles.center}>
        {text}
      </ThemedText>
      <View style={{ gap: 10, alignSelf: 'stretch' }}>{children}</View>
    </View>
  );
}

// Para las pantallas que necesitan internet (Descubrir, buscar, listas de otros...).
export function OfflineGate({ children, what = 'Esta pantalla' }: { children: ReactNode; what?: string }) {
  const offline = useOfflineMode();
  if (!offline) return <>{children}</>;
  return (
    <OfflineNotice
      title="Sin conexión"
      text={`${what} necesita internet. Mientras tanto puedes ver y gestionar tu perfil.`}
    >
      <DarkButton label="Ir a mi perfil" onPress={() => router.replace('/profile')} />
      {router.canGoBack() ? <LightButton label="Volver" onPress={() => goBack()} /> : null}
    </OfflineNotice>
  );
}

// Antes de enseñar tus datos: espera a la primera descarga desde Supabase
// (o, sin conexión, usa la copia descargada si la tienes).
export function CloudGate({ children }: { children: ReactNode }) {
  const online = useOnline();
  const ready = useSync((s) => s.ready);
  const status = useSync((s) => s.status);
  const error = useSync((s) => s.error);
  const offlineEnabled = useStore((s) => s.offlineEnabled);
  const cloudUserId = useStore((s) => s.cloudUserId);
  const c = useIgnColors();
  if (!isCloudEnabled() || !cloudUserId || ready || offlineEnabled) return <>{children}</>;
  if (!online) {
    return (
      <OfflineNotice
        icon="download-outline"
        title="Sin conexión"
        text="No tienes tu perfil descargado en este móvil, así que no se puede mostrar nada sin internet. Cuando vuelvas a tener conexión, puedes descargarlo desde tu Perfil para usarlo sin conexión."
      />
    );
  }
  if (status === 'error') {
    return (
      <OfflineNotice
        icon="alert-circle-outline"
        title="No se pudieron cargar tus datos"
        text={error ?? 'Error desconocido'}
      >
        <DarkButton label="Reintentar" onPress={() => syncNow()} />
      </OfflineNotice>
    );
  }
  return (
    <View style={[styles.full, { backgroundColor: c.bg }]}>
      <ActivityIndicator color={c.text} size="large" />
      <ThemedText variant="muted">Cargando tu perfil…</ThemedText>
    </View>
  );
}

// Franja que avisa del modo sin conexión (encima de la barra de pestañas).
export function OfflineBanner() {
  const offline = useOfflineMode();
  const pending = useStore(pendingCount);
  const c = useIgnColors();
  if (!offline || !isCloudEnabled()) return null;
  return (
    <View style={[styles.banner, { backgroundColor: c.inverseBg }]}>
      <Ionicons name="cloud-offline" size={14} color={c.inverseText} />
      <ThemedText variant="bold" size={11} style={{ color: c.inverseText, flex: 1 }} numberOfLines={1}>
        Sin conexión · modo perfil{pending ? ` · ${pending} cambios por subir` : ''}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 30 },
  center: { textAlign: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6 },
});
