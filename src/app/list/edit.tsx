import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DragList } from '@/components/DragList';
import { Card, DarkButton, GameLine, IgnScreen, Sheet, SheetRow, useIgnColors } from '@/components/ign';
import { Segmented } from '@/components/Segmented';
import { ThemedText } from '@/components/ThemedText';
import { TextField, type IconName } from '@/components/ui';
import { LIST_COLORS, LIST_ICONS } from '@/data/meta';
import { useFillBasics } from '@/hooks/useIgdb';
import { useListEntries } from '@/hooks/useLists';
import { useStore } from '@/store/useStore';
import type { GameList, Visibility } from '@/types';
import type { Entry } from '@/utils/library';
import { notify } from '@/utils/notify';
import { goBack } from '@/utils/nav';

const ROW_H = 100;

// "Editar lista" de IGN: ajustes plegables y juegos que se ordenan arrastrando.
export default function EditListScreen() {
  const { id, addGame } = useLocalSearchParams<{ id?: string; addGame?: string }>();
  const existing = useStore((s) => (id ? s.lists[id] : undefined));
  if (!existing) return <NewList addGame={addGame} />;
  return <EditItems list={existing} />;
}

type Settings = { name: string; description: string; visibility: Visibility; colors: [string, string]; icon: string };

function SettingsForm({ value, onChange }: { value: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const c = useIgnColors();
  return (
    <View style={{ gap: 16 }}>
      <TextField
        label="Nombre"
        value={value.name}
        onChangeText={(name) => onChange({ name })}
        placeholder="2026, Mis RPG, Pendientes…"
        maxLength={60}
      />
      <TextField
        label="Descripción"
        value={value.description}
        onChangeText={(description) => onChange({ description })}
        placeholder="¿De qué va esta lista?"
        multiline
        maxLength={400}
      />
      <View style={{ gap: 8 }}>
        <ThemedText variant="bold" size={13}>
          Visibilidad
        </ThemedText>
        <Segmented
          value={value.visibility}
          onChange={(visibility) => onChange({ visibility })}
          options={[
            { value: 'private', label: '🔒 Privada' },
            { value: 'public', label: '🌐 Pública' },
          ]}
        />
        <ThemedText variant="muted" size={12}>
          {value.visibility === 'public'
            ? 'Cualquiera puede verla, seguirla y copiarla a su perfil.'
            : 'Solo tú puedes verla.'}
        </ThemedText>
      </View>
      <View style={{ gap: 8 }}>
        <ThemedText variant="bold" size={13}>
          Colores (si la lista no tiene portadas)
        </ThemedText>
        <View style={styles.wrap}>
          {LIST_COLORS.map((pair) => {
            const on = pair[0] === value.colors[0] && pair[1] === value.colors[1];
            return (
              <Pressable
                key={pair.join()}
                onPress={() => onChange({ colors: pair })}
                style={[styles.swatch, { borderColor: on ? c.text : 'transparent' }]}
              >
                <LinearGradient colors={pair} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.swatchFill} />
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <ThemedText variant="bold" size={13}>
          Icono
        </ThemedText>
        <View style={styles.wrap}>
          {LIST_ICONS.map((name) => {
            const on = name === value.icon;
            return (
              <Pressable
                key={name}
                onPress={() => onChange({ icon: name })}
                style={[styles.iconCell, { backgroundColor: on ? c.inverseBg : c.soft, borderRadius: 10 }]}
              >
                <Ionicons name={name as IconName} size={22} color={on ? c.inverseText : c.text} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function NewList({ addGame }: { addGame?: string }) {
  const createList = useStore((s) => s.createList);
  const addToList = useStore((s) => s.addToList);
  const [value, setValue] = useState<Settings>({
    name: '',
    description: '',
    visibility: 'private',
    colors: LIST_COLORS[1],
    icon: 'albums',
  });
  const create = () => {
    if (!value.name.trim()) {
      Alert.alert('Ponle un nombre', 'Por ejemplo «2026» o «Pendientes de PS5».');
      return;
    }
    const newId = createList({
      name: value.name,
      description: value.description,
      visibility: value.visibility,
      color: value.colors[0],
      color2: value.colors[1],
      icon: value.icon,
    });
    if (addGame) {
      addToList(newId, addGame);
      notify('Lista creada con el juego');
      goBack();
    } else {
      router.replace(`/list/${newId}`);
    }
  };
  return (
    <IgnScreen title="Nueva lista" back keyboardShouldPersistTaps="handled">
      <View style={{ paddingHorizontal: 20, gap: 20 }}>
        <Card>
          <SettingsForm value={value} onChange={(patch) => setValue((v) => ({ ...v, ...patch }))} />
        </Card>
        <DarkButton label="Crear lista" onPress={create} />
      </View>
    </IgnScreen>
  );
}

function EditItems({ list }: { list: GameList }) {
  const c = useIgnColors();
  const insets = useSafeAreaInsets();
  const entries = useListEntries(list.id);
  const updateList = useStore((s) => s.updateList);
  const moveInList = useStore((s) => s.moveInList);
  const removeFromList = useStore((s) => s.removeFromList);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<Entry | null>(null);
  const isOwner = useStore((s) => s.currentProfileId === list.ownerId);
  useFillBasics(entries.map((e) => e.game));

  const settings: Settings = {
    name: list.name,
    description: list.description,
    visibility: list.visibility,
    colors: [list.color, list.color2],
    icon: list.icon,
  };
  const change = (patch: Partial<Settings>) => {
    const { colors, ...rest } = patch;
    updateList(list.id, { ...rest, ...(colors ? { color: colors[0], color2: colors[1] } : {}) });
  };

  const header = (
    <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 20 }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack()} style={styles.backRow} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={c.text} />
          <ThemedText size={16}>Atrás</ThemedText>
        </Pressable>
        <Pressable onPress={() => router.push(`/search?listId=${list.id}`)} hitSlop={10}>
          <Ionicons name="add-circle-outline" size={28} color={c.text} />
        </Pressable>
      </View>
      <ThemedText variant="display" size={32} style={{ marginTop: 10, marginBottom: 16 }}>
        {isOwner ? 'Editar lista' : 'Editar orden'}
      </ThemedText>
      {isOwner ? (
        <Card padded={false} style={{ marginBottom: 14 }}>
          <Pressable onPress={() => setOpen((o) => !o)} style={styles.settingsHead}>
            <ThemedText size={17} style={{ flex: 1 }}>
              Ajustes
            </ThemedText>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={c.muted} />
          </Pressable>
          {open ? (
            <View style={{ padding: 18, paddingTop: 0 }}>
              <SettingsForm value={settings} onChange={change} />
            </View>
          ) : null}
        </Card>
      ) : (
        <ThemedText variant="muted" size={12} style={{ marginBottom: 12 }}>
          Lista cooperativa: lo que cambies aquí lo verán todos los que están en ella.
        </ThemedText>
      )}
      {entries.length === 0 ? (
        <ThemedText variant="muted" size={14} style={{ marginVertical: 20 }}>
          No hay juegos todavía. Pulsa ⊕ para añadir.
        </ThemedText>
      ) : (
        <ThemedText variant="muted" size={12} style={{ marginBottom: 4 }}>
          Arrastra ⁞⁞ para cambiar el orden. Toca un juego para más opciones.
        </ThemedText>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <DragList
        data={entries}
        keyOf={(e) => e.item.id}
        rowHeight={ROW_H}
        header={header}
        contentPaddingBottom={insets.bottom + 60}
        onMove={(from, to) => moveInList(list.id, from, to)}
        renderHandle={() => <Ionicons name="reorder-four" size={22} color={c.muted} />}
        renderRow={(entry, index, handle) => (
          <View style={[styles.rowWrap, { backgroundColor: c.bg }]}>
            <View style={{ flex: 1 }}>
              <GameLine
                game={entry.game}
                rank={index + 1}
                status={entry.userGame?.status}
                onPress={() => setMenu(entry)}
                right={handle}
              />
            </View>
          </View>
        )}
      />
      {menu ? (
        <Sheet visible title={menu.game.title} onClose={() => setMenu(null)}>
          <SheetRow
            label="Ver ficha del juego"
            right={<Ionicons name="open-outline" size={22} color={c.text} />}
            onPress={() => {
              setMenu(null);
              router.push(`/game/${encodeURIComponent(menu.game.id)}`);
            }}
          />
          <SheetRow
            label="Mover al principio"
            right={<Ionicons name="arrow-up" size={22} color={c.text} />}
            onPress={() => {
              moveInList(list.id, entries.indexOf(menu), 0);
              setMenu(null);
            }}
          />
          <SheetRow
            label="Mover al final"
            right={<Ionicons name="arrow-down" size={22} color={c.text} />}
            onPress={() => {
              moveInList(list.id, entries.indexOf(menu), entries.length - 1);
              setMenu(null);
            }}
          />
          <SheetRow
            label="Quitar de la lista"
            right={<Ionicons name="trash-outline" size={22} color="#e5484d" />}
            onPress={() => {
              removeFromList(list.id, menu.game.id);
              notify('Quitado de la lista');
              setMenu(null);
            }}
            last
          />
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', height: 44 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  settingsHead: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  rowWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: ROW_H },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, padding: 2 },
  swatchFill: { flex: 1, borderRadius: 20 },
  iconCell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
