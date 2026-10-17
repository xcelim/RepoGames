import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/lists';
import { Section } from '@/components/Section';
import { Segmented } from '@/components/Segmented';
import { ThemedText } from '@/components/ThemedText';
import { TextField, type IconName } from '@/components/ui';
import { LIST_COLORS, LIST_ICONS } from '@/data/meta';
import { useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';
import type { Visibility } from '@/types';

export default function EditListScreen() {
  const { id, addGame } = useLocalSearchParams<{ id?: string; addGame?: string }>();
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  const existing = useStore((s) => (id ? s.lists[id] : undefined));
  const createList = useStore((s) => s.createList);
  const updateList = useStore((s) => s.updateList);
  const deleteList = useStore((s) => s.deleteList);
  const addToList = useStore((s) => s.addToList);

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? 'private');
  const [colors, setColors] = useState<[string, string]>(
    existing ? [existing.color, existing.color2] : LIST_COLORS[1],
  );
  const [icon, setIcon] = useState(existing?.icon ?? 'albums');

  const save = () => {
    if (!name.trim()) {
      Alert.alert('Ponle un nombre', 'Por ejemplo «2026» o «Pendientes de PS5».');
      return;
    }
    const data = { name, description, visibility, color: colors[0], color2: colors[1], icon };
    if (existing) {
      updateList(existing.id, data);
      router.back();
    } else {
      const newId = createList(data);
      if (addGame) addToList(newId, addGame);
      router.replace(`/list/${newId}`);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Eliminar lista', `«${existing.name}» se borrará. Tus notas y estados se conservan.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          deleteList(existing.id);
          router.dismissAll();
          router.replace('/lists');
        },
      },
    ]);
  };

  return (
    <View style={styles.flex}>
      <ScreenHeader close title={existing ? 'Editar lista' : 'Nueva lista'} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.preview, { borderRadius: Math.min(skin.radius, 18) }]}>
          <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Ionicons name={icon as IconName} size={90} color="rgba(255,255,255,0.25)" style={styles.previewIcon} />
          <ThemedText variant="display" size={26} style={styles.white} numberOfLines={2}>
            {name || 'Mi lista'}
          </ThemedText>
        </View>

        <TextField label="Nombre" value={name} onChangeText={setName} placeholder="2026, Mis RPG, Pendientes…" maxLength={60} />
        <TextField
          label="Descripción"
          value={description}
          onChangeText={setDescription}
          placeholder="¿De qué va esta lista?"
          multiline
          maxLength={400}
        />

        <Section title="Visibilidad">
          <Segmented
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: 'private', label: '🔒 Privada' },
              { value: 'public', label: '🌐 Pública' },
            ]}
          />
          <ThemedText variant="muted" size={12}>
            {visibility === 'public'
              ? 'Cualquiera puede verla, seguirla y copiarla a su perfil.'
              : 'Solo tú puedes verla.'}
          </ThemedText>
        </Section>

        <Section title="Colores">
          <View style={styles.wrap}>
            {LIST_COLORS.map((pair) => {
              const active = pair[0] === colors[0] && pair[1] === colors[1];
              return (
                <Pressable
                  key={pair.join()}
                  onPress={() => setColors(pair)}
                  style={[styles.swatch, { borderColor: active ? skin.colors.text : 'transparent' }]}
                >
                  <LinearGradient colors={pair} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.swatchFill} />
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Icono">
          <View style={styles.wrap}>
            {LIST_ICONS.map((name) => {
              const active = name === icon;
              return (
                <Pressable
                  key={name}
                  onPress={() => setIcon(name)}
                  style={[
                    styles.iconCell,
                    {
                      backgroundColor: active ? skin.colors.accent : skin.colors.panel,
                      borderColor: skin.colors.line,
                      borderRadius: Math.min(skin.radius, 12),
                    },
                  ]}
                >
                  <Ionicons
                    name={name as IconName}
                    size={22}
                    color={active ? skin.colors.onAccent : skin.colors.text}
                  />
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Button label={existing ? 'Guardar cambios' : 'Crear lista'} onPress={save} />
        {existing ? <Button kind="ghost" label="Eliminar lista" onPress={remove} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  white: { color: '#ffffff' },
  content: { paddingHorizontal: 16, gap: 18 },
  preview: { height: 130, overflow: 'hidden', justifyContent: 'flex-end', padding: 16 },
  previewIcon: { position: 'absolute', right: 6, top: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, padding: 2 },
  swatchFill: { flex: 1, borderRadius: 20 },
  iconCell: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
