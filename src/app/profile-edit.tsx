import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarFrame } from '@/components/AvatarFrame';
import { Button } from '@/components/Button';
import { useLevel } from '@/hooks/useLevel';
import { ScreenHeader } from '@/components/lists';
import { ThemedText } from '@/components/ThemedText';
import { Avatar, TextField } from '@/components/ui';
import { slugify } from '@/utils/text';
import { AVATAR_COLORS } from '@/data/meta';
import { useCurrentProfile, useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';
import { goBack } from '@/utils/nav';

export default function ProfileEditScreen() {
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  const profile = useCurrentProfile();
  const updateProfile = useStore((s) => s.updateProfile);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [color, setColor] = useState(profile?.avatarColor ?? AVATAR_COLORS[0]);
  const [photo, setPhoto] = useState<string | null>(profile?.photo ?? null);
  const [photoError, setPhotoError] = useState('');
  const lv = useLevel();

  // Foto: se recorta cuadrada y se guarda pequeña (256 px) para que vaya rápida y se sincronice.
  const pickPhoto = async () => {
    setPhotoError('');
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setPhotoError('Necesito permiso para ver tus fotos.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (res.canceled || !res.assets[0]) return;
      const small = await ImageManipulator.manipulateAsync(
        res.assets[0].uri,
        [{ resize: { width: 256, height: 256 } }],
        {
          compress: 0.72,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );
      if (small.base64) setPhoto(`data:image/jpeg;base64,${small.base64}`);
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'No se pudo cargar la foto');
    }
  };

  const save = () => {
    updateProfile({
      displayName: displayName.trim() || profile?.displayName,
      username: slugify(username) || profile?.username,
      bio: bio.trim(),
      avatarColor: color,
      photo,
    });
    goBack();
  };

  return (
    <View style={styles.flex}>
      <ScreenHeader close title="Editar perfil" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.center}>
          <Pressable onPress={pickPhoto}>
            <AvatarFrame frame={lv.frame} size={96}>
              <Avatar name={displayName || '?'} color={color} uri={photo} size={96} />
            </AvatarFrame>
          </Pressable>
          <View style={styles.photoBtns}>
            <Pressable onPress={pickPhoto} hitSlop={8}>
              <ThemedText variant="bold" size={13} style={{ textDecorationLine: 'underline' }}>
                {photo ? 'Cambiar foto' : 'Poner foto'}
              </ThemedText>
            </Pressable>
            {photo ? (
              <Pressable onPress={() => setPhoto(null)} hitSlop={8}>
                <ThemedText variant="muted" size={13} style={{ textDecorationLine: 'underline' }}>
                  Quitar foto
                </ThemedText>
              </Pressable>
            ) : null}
            <Pressable onPress={() => router.push('/level')} hitSlop={8}>
              <ThemedText variant="muted" size={13} style={{ textDecorationLine: 'underline' }}>
                Cambiar marco
              </ThemedText>
            </Pressable>
          </View>
          {photoError ? (
            <ThemedText size={12} style={{ color: '#e5484d' }}>
              {photoError}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.colors}>
          {AVATAR_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[
                styles.color,
                { backgroundColor: c, borderColor: c === color ? skin.colors.text : 'transparent' },
              ]}
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
  center: { alignItems: 'center', gap: 12 },
  photoBtns: { flexDirection: 'row', gap: 18 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  color: { width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
});
