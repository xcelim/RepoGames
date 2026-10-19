import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { finishOnboarding, isUsernameFree } from '@/cloud/sync';
import { DarkButton, useIgnColors } from '@/components/ign';
import { SkinPicker } from '@/components/SkinPicker';
import { ThemedText } from '@/components/ThemedText';
import { Avatar, Panel, TextField } from '@/components/ui';
import { AVATAR_COLORS } from '@/data/meta';
import { useCurrentProfile } from '@/store/useStore';
import { slugify } from '@/utils/text';

// Primera vez con una cuenta (por ejemplo, al entrar con Google): crea tu usuario.
export default function OnboardingScreen() {
  const c = useIgnColors();
  const insets = useSafeAreaInsets();
  const profile = useCurrentProfile();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [username, setUsername] = useState(profile ? profile.username.replace(/-[0-9a-f]{5}$/, '') : '');
  const [color, setColor] = useState(profile?.avatarColor ?? AVATAR_COLORS[0]);
  const [free, setFree] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const clean = slugify(username || name).slice(0, 30);

  // Comprueba si el usuario está libre mientras escribes.
  useEffect(() => {
    if (clean.length < 3) return;
    let alive = true;
    const t = setTimeout(() => {
      isUsernameFree(clean)
        .then((ok) => alive && setFree(ok))
        .catch(() => alive && setFree(null));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [clean]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (!name.trim()) throw new Error('Pon tu nombre.');
      await finishOnboarding({ displayName: name, username: clean, avatarColor: color });
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText variant="display" size={32}>
          Crea tu usuario
        </ThemedText>
        <ThemedText variant="muted">
          Así te verán los demás en tus listas públicas y reseñas. Tu progreso se guarda en tu cuenta y lo verás en
          cualquier dispositivo en el que entres.
        </ThemedText>
        <Panel>
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
            onChangeText={(v) => {
              setUsername(v);
              setFree(null);
            }}
            placeholder={slugify(name) || 'tu-usuario'}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
          />
          <ThemedText size={12} style={{ color: free === false ? '#e5484d' : free ? '#6aa834' : c.muted }}>
            {clean.length < 3
              ? 'Mínimo 3 caracteres: letras, números y guiones.'
              : free === false
                ? `@${clean} ya está cogido`
                : free
                  ? `@${clean} está libre`
                  : `@${clean}`}
          </ThemedText>
          <ThemedText variant="muted" size={12}>
            Color
          </ThemedText>
          <View style={styles.colors}>
            {AVATAR_COLORS.map((col) => (
              <Pressable
                key={col}
                onPress={() => setColor(col)}
                accessibilityLabel={`Color ${col}`}
                style={[styles.color, { backgroundColor: col, borderColor: col === color ? c.text : 'transparent' }]}
              />
            ))}
          </View>
          <View style={styles.preview}>
            <Avatar name={name || '?'} color={color} size={52} />
            <View>
              <ThemedText variant="bold">{name || 'Tu nombre'}</ThemedText>
              <ThemedText variant="muted" size={12}>
                @{clean || 'tu-usuario'}
              </ThemedText>
            </View>
          </View>
          {busy ? (
            <ActivityIndicator color={c.text} />
          ) : (
            <DarkButton label="Empezar" onPress={save} disabled={free === false} />
          )}
          {error ? (
            <ThemedText size={13} style={{ color: '#e5484d' }}>
              {error}
            </ThemedText>
          ) : null}
        </Panel>
        <ThemedText variant="bold">Elige tu estética</ThemedText>
        <SkinPicker />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 20 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  color: { width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
