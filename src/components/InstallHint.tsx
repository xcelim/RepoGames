// En el iPhone (Safari) no hay APK: se explica cómo dejar la web como una app más en la pantalla de inicio.
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIgnColors } from './ign';
import { ThemedText } from './ThemedText';

const KEY = 'install-hint:closed';

function isIosBrowser(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches);
  return ios && !standalone;
}

export function InstallHint() {
  const c = useIgnColors();
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!isIosBrowser()) return;
    AsyncStorage.getItem(KEY)
      .then((v) => {
        // Se vuelve a enseñar a la semana si no la ha instalado.
        if (!v || Date.now() - Number(v) > 7 * 86_400_000) setShow(true);
      })
      .catch(() => setShow(true));
  }, []);
  if (!show) return null;
  const close = () => {
    setShow(false);
    AsyncStorage.setItem(KEY, String(Date.now())).catch(() => undefined);
  };
  return (
    <View
      style={[
        styles.box,
        { bottom: insets.bottom + 84, backgroundColor: c.card, borderColor: c.line, borderRadius: c.radius + 4 },
      ]}
    >
      <Ionicons name="share-outline" size={26} color={c.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText variant="bold" size={14}>
          Instala Saga Quest en tu iPhone
        </ThemedText>
        <ThemedText variant="muted" size={12}>
          Pulsa Compartir y luego «Añadir a pantalla de inicio». Se abrirá a pantalla completa, como una app.
        </ThemedText>
      </View>
      <Pressable onPress={close} hitSlop={10} accessibilityLabel="Cerrar">
        <Ionicons name="close" size={20} color={c.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    zIndex: 50,
  },
});
