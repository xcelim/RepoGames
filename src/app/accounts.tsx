import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloudAccountPanel, OfflineDownloadCard } from '@/components/cloudPanel';
import { ScreenHeader } from '@/components/lists';
import { ThemedText } from '@/components/ThemedText';

// Tu cuenta: sesión, sincronización, descarga para usar sin conexión y cerrar sesión.
export default function AccountsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.flex}>
      <ScreenHeader close title="Cuenta" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <CloudAccountPanel />
        <OfflineDownloadCard />
        <ThemedText variant="muted" size={12}>
          Para usar otra cuenta, cierra sesión y entra con ella. Tu progreso se ve en cualquier dispositivo en el que
          entres con la misma cuenta (correo o Google).
        </ThemedText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
});
