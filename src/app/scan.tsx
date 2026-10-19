import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lookupBarcode } from '@/api/barcode';
import { DarkButton, LightButton } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';

// Escanear el código de barras de la caja de un juego y buscarlo en IGDB.
export default function ScanScreen() {
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<{ kind: 'scanning' } | { kind: 'looking'; code: string } | { kind: 'unknown'; code: string }>({
    kind: 'scanning',
  });
  const busy = useRef(false);

  const goSearch = (q: string) => {
    const params = [`q=${encodeURIComponent(q)}`, listId ? `listId=${listId}` : ''].filter(Boolean).join('&');
    router.replace(`/search?${params}`);
  };

  const onScan = async (result: BarcodeScanningResult) => {
    if (busy.current) return;
    busy.current = true;
    const code = result.data;
    setState({ kind: 'looking', code });
    const title = await lookupBarcode(code);
    if (title) goSearch(title);
    else setState({ kind: 'unknown', code });
  };

  const retry = () => {
    busy.current = false;
    setState({ kind: 'scanning' });
  };

  const close = (
    <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.close, { top: insets.top + 10 }]}>
      <Ionicons name="close" size={30} color="#fff" />
    </Pressable>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.center}>
        <ThemedText size={15}>El escáner solo funciona en el móvil.</ThemedText>
        <LightButton label="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  if (!permission) return <View style={styles.black} />;

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: '#000' }]}>
        {close}
        <Ionicons name="barcode-outline" size={64} color="#fff" />
        <ThemedText size={16} style={styles.whiteText}>
          Para escanear el código de barras de tus juegos, Saga Quest necesita la cámara.
        </ThemedText>
        <DarkButton label="Permitir la cámara" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.black}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={state.kind === 'scanning' ? onScan : undefined}
      />
      {close}
      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.frame} />
      </View>
      <View style={[styles.panel, { paddingBottom: insets.bottom + 24 }]}>
        {state.kind === 'scanning' ? (
          <ThemedText size={15} style={styles.whiteText}>
            Apunta al código de barras de la caja del juego.
          </ThemedText>
        ) : state.kind === 'looking' ? (
          <View style={styles.row}>
            <ActivityIndicator color="#fff" />
            <ThemedText size={15} style={styles.whiteText}>
              Buscando el juego del código {state.code}…
            </ThemedText>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <ThemedText size={15} style={styles.whiteText}>
              No conozco el código {state.code}. Prueba otra vez o búscalo por su nombre.
            </ThemedText>
            <DarkButton label="Escanear otra vez" icon="scan" onPress={retry} />
            <LightButton label="Buscar por nombre" onPress={() => goSearch('')} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 30 },
  whiteText: { color: '#fff', textAlign: 'center' },
  close: { position: 'absolute', right: 18, zIndex: 2 },
  frameWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 280, height: 160, borderWidth: 3, borderColor: '#fff', borderRadius: 18 },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 22, backgroundColor: 'rgba(0,0,0,0.65)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'center' },
});
