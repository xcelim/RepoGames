import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/lists';
import { ThemedText } from '@/components/ThemedText';
import { Avatar, TextField } from '@/components/ui';
import { slugify } from '@/utils/text';
import { AVATAR_COLORS } from '@/data/meta';
import { useCurrentProfile, useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';

export default function ProfileEditScreen() {
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  const profile = useCurrentProfile();
  const updateProfile = useStore((s) => s.updateProfile);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [color, setColor] = useState(profile?.avatarColor ?? AVATAR_COLORS[0]);

  const save = () => {
    updateProfile({
      displayName: displayName.trim() || profile?.displayName,
      username: slugify(username) || profile?.username,
      bio: bio.trim(),
      avatarColor: color,
    });
    router.back();
  };

  return (
    <View style={styles.flex}>
      <ScreenHeader close title="Editar perfil" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.center}>
          <Avatar name={displayName || '?'} color={color} size={88} />
        </View>
        <View style={styles.colors}>
          {AVATAR_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[styles.color, { backgroundColor: c, borderColor: c === color ? skin.colors.text : 'transparent' }]}
            />
          ))}
        </View>
        <TextField label="Nombre" value={displayName} onChangeText={setDisplayName} maxLength={40} />
        <TextField
          label="Usuario"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={24}
        />
        <ThemedText variant="muted" size={12}>
          Se verá como @{slugify(username) || 'usuario'}
        </ThemedText>
        <TextField label="Sobre ti" value={bio} onChangeText={setBio} multiline maxLength={240} />
        <Button label="Guardar" onPress={save} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14 },
  center: { alignItems: 'center' },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  color: { width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
});
