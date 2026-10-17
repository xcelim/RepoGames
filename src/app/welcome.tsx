import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Section } from '@/components/Section';
import { SkinPicker } from '@/components/SkinPicker';
import { ThemedText } from '@/components/ThemedText';
import { Avatar, Panel, TextField } from '@/components/ui';
import { AVATAR_COLORS } from '@/data/meta';
import { slugify } from '@/data/catalog';
import { useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';

export default function WelcomeScreen() {
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  const profiles = useStore((s) => s.profiles);
  const createProfile = useStore((s) => s.createProfile);
  const switchProfile = useStore((s) => s.switchProfile);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const existing = Object.values(profiles);

  const create = () => {
    if (!name.trim()) return;
    createProfile({
      displayName: name,
      username: slugify(username || name) || 'jugador',
      avatarColor: color,
    });
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText variant="muted" size={12}>
          {'// TU REGISTRO DE PARTIDAS'}
        </ThemedText>
        <ThemedText variant="display" size={46}>
          Saga
          <ThemedText variant="display" size={46} style={{ color: skin.colors.accent }}>
            {'//'}
          </ThemedText>
          Quest
        </ThemedText>
        <ThemedText variant="muted">
          Guarda todo lo que juegas, ponle nota, ordena tus bibliotecas y compártelas. Empezarás con
          las sagas de Persona, Fire Emblem, Final Fantasy, Zelda, Kirby, Mario, Xenoblade y
          Metroid ya en tu perfil.
        </ThemedText>

        {existing.length > 0 ? (
          <Section title="Seguir con una cuenta">
            {existing.map((profile) => (
              <Pressable
                key={profile.id}
                onPress={() => {
                  switchProfile(profile.id);
                  router.replace('/');
                }}
                style={styles.account}
              >
                <Avatar name={profile.displayName} color={profile.avatarColor} />
                <View style={styles.flex}>
                  <ThemedText variant="bold">{profile.displayName}</ThemedText>
                  <ThemedText variant="muted" size={12}>
                    @{profile.username}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </Section>
        ) : null}

        <Panel>
          <ThemedText variant="display" size={22}>
            Crea tu perfil
          </ThemedText>
          <TextField
            label="Nombre"
            value={name}
            onChangeText={setName}
            placeholder="Cómo quieres que te vean"
            maxLength={40}
          />
          <TextField
            label="Usuario"
            value={username}
            onChangeText={setUsername}
            placeholder={slugify(name) || 'tu-usuario'}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
          />
          <ThemedText variant="muted" size={12}>
            Color
          </ThemedText>
          <View style={styles.colors}>
            {AVATAR_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                accessibilityLabel={`Color ${c}`}
                style={[
                  styles.color,
                  { backgroundColor: c, borderColor: c === color ? skin.colors.text : 'transparent' },
                ]}
              />
            ))}
          </View>
          <View style={styles.preview}>
            <Avatar name={name || '?'} color={color} size={52} />
            <View>
              <ThemedText variant="bold">{name || 'Tu nombre'}</ThemedText>
              <ThemedText variant="muted" size={12}>
                @{slugify(username || name) || 'tu-usuario'}
              </ThemedText>
            </View>
          </View>
          <Button label="Empezar" onPress={create} />
        </Panel>

        <Section title="Elige tu estética">
          <SkinPicker />
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 22 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  color: { width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
