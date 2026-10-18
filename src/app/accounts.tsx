import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/lists';
import { ThemedText } from '@/components/ThemedText';
import { Avatar, Panel } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';
import { CloudAccountPanel, OfflineDownloadCard } from '@/components/cloudPanel';
import { isCloudEnabled } from '@/cloud/supabase';

function LocalAccounts() {
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  const profiles = useStore((s) => s.profiles);
  const currentId = useStore((s) => s.currentProfileId);
  const switchProfile = useStore((s) => s.switchProfile);
  const deleteProfile = useStore((s) => s.deleteProfile);
  const signOut = useStore((s) => s.signOut);

  const remove = (id: string, name: string) =>
    Alert.alert('Eliminar cuenta', `Se borrarán las listas, notas y reseñas de ${name} en este móvil.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          deleteProfile(id);
          if (id === currentId) {
            router.dismissAll();
            router.replace('/welcome');
          }
        },
      },
    ]);

  return (
    <View style={styles.flex}>
      <ScreenHeader close title="Cuentas" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <ThemedText variant="muted" size={13}>
          Cada cuenta tiene su biblioteca, sus notas y sus listas. Las listas públicas de una cuenta
          aparecen en «De la comunidad» de las demás. Con Supabase (Ajustes → Nube) serán usuarios
          reales con su correo.
        </ThemedText>
        {Object.values(profiles).map((profile) => {
          const active = profile.id === currentId;
          return (
            <Panel key={profile.id} style={styles.row}>
              <Pressable
                style={styles.rowMain}
                onPress={() => {
                  switchProfile(profile.id);
                  router.dismissAll();
                }}
              >
                <Avatar name={profile.displayName} color={profile.avatarColor} />
                <View style={styles.flex}>
                  <ThemedText variant="bold">{profile.displayName}</ThemedText>
                  <ThemedText variant="muted" size={12}>
                    @{profile.username}
                  </ThemedText>
                </View>
                {active ? <Ionicons name="checkmark-circle" size={24} color={skin.colors.accent} /> : null}
              </Pressable>
              <Pressable onPress={() => remove(profile.id, profile.displayName)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color="#e5484d" />
              </Pressable>
            </Panel>
          );
        })}
        <Button
          label="+ Crear otra cuenta"
          onPress={() => {
            signOut();
            router.dismissAll();
            router.replace('/welcome');
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
});

// Con Supabase cada cuenta es un usuario real: aquí se ve tu sesión y se cierra.
export default function AccountsScreen() {
  const insets = useSafeAreaInsets();
  if (!isCloudEnabled()) return <LocalAccounts />;
  return (
    <View style={styles.flex}>
      <ScreenHeader close title="Cuenta" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <CloudAccountPanel />
        <OfflineDownloadCard />
        <ThemedText variant="muted" size={12}>
          Para usar otra cuenta, cierra sesión y entra con ella.
        </ThemedText>
      </ScrollView>
    </View>
  );
}
