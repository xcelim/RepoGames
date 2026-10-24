import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { completeOAuth } from '@/cloud/sync';
import { DarkButton, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';

// Vuelta de Google: si el sistema abre la app con el enlace (en vez de devolverlo al
// navegador de inicio de sesión), aquí se termina de entrar.
export default function AuthCallback() {
  const c = useIgnColors();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const url = Linking.useURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => typeof v === 'string') as [string, string][],
    ).toString();
    const target =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.href
        : (url ?? `sagaquest://auth-callback?${query}`);
    completeOAuth(target)
      .then(() => router.replace('/'))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.full, { backgroundColor: c.bg }]}>
      {error ? (
        <>
          <ThemedText variant="bold">No se pudo entrar con Google</ThemedText>
          <ThemedText variant="muted" style={{ textAlign: 'center' }}>
            {error}
          </ThemedText>
          <DarkButton label="Volver" onPress={() => router.replace('/welcome')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={c.text} size="large" />
          <ThemedText variant="muted">Entrando con Google…</ThemedText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 30 },
});
