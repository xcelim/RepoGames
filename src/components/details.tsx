// Detalles de tu partida: fechas, físico, rejugadas y notas por lista.
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { createElement, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useStore } from '@/store/useStore';
import type { GameList, GameRecord } from '@/types';
import { itemsOfList, replayStats, userGameKey } from '@/utils/library';

import { DarkButton, Sheet, ToggleRow, useIgnColors } from './ign';
import { ReplayBadge } from './replayBadge';
import { ThemedText } from './ThemedText';
import { TextField } from './ui';

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function formatDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------- Contador − n + ----------

export function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  const c = useIgnColors();
  const btn = (icon: 'remove' | 'add', delta: number, disabled: boolean) => (
    <Pressable
      disabled={disabled}
      onPress={() => onChange(value + delta)}
      hitSlop={6}
      style={[styles.stepBtn, { backgroundColor: c.soft, opacity: disabled ? 0.35 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={c.text} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {btn('remove', -1, value <= min)}
      <ThemedText variant="bold" size={18} style={{ minWidth: 30, textAlign: 'center' }}>
        {value}
      </ThemedText>
      {btn('add', 1, false)}
    </View>
  );
}

// ---------- Fecha (con calendario en el móvil) ----------

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const c = useIgnColors();
  const [iosOpen, setIosOpen] = useState(false);
  const current = value ? new Date(`${value}T12:00:00`) : new Date();

  const open = () => {
    if (Platform.OS === 'web') return;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        maximumDate: new Date(),
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(iso(date));
        },
      });
    } else setIosOpen((o) => !o);
  };

  return (
    <View>
      <Pressable
        onPress={open}
        style={[styles.dateRow, { backgroundColor: c.card, borderColor: c.line, borderRadius: c.radius }]}
      >
        <Ionicons name="calendar-outline" size={20} color={c.muted} />
        <ThemedText size={14} style={{ flex: 1 }}>
          {label}
        </ThemedText>
        <ThemedText variant={value ? 'bold' : 'muted'} size={14}>
          {formatDay(value) ?? 'Elegir fecha'}
        </ThemedText>
        {Platform.OS === 'web'
          ? // En la web, el calendario del navegador (un campo de fecha invisible encima de la fila).
            createElement('input', {
              type: 'date',
              value: value ?? '',
              max: iso(new Date()),
              'aria-label': label,
              onChange: (e: { target: { value: string } }) => onChange(e.target.value || null),
              onClick: (e: { currentTarget: { showPicker?: () => void } }) => {
                try {
                  e.currentTarget.showPicker?.();
                } catch {
                  // algunos navegadores no lo permiten: se abre igual al tocar
                }
              },
              style: {
                position: 'absolute',
                inset: 0,
                opacity: 0,
                width: '100%',
                height: '100%',
                cursor: 'pointer',
                border: 0,
              },
            })
          : null}
        {value ? (
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={10}
            accessibilityLabel={`Quitar ${label}`}
            style={{ zIndex: 2 }}
          >
            <Ionicons name="close-circle" size={20} color={c.muted} />
          </Pressable>
        ) : null}
      </Pressable>
      {iosOpen ? (
        <DateTimePicker
          value={current}
          mode="date"
          display="inline"
          maximumDate={new Date()}
          onChange={(_e, date) => date && onChange(iso(date))}
        />
      ) : null}
    </View>
  );
}

// ---------- Bloque "Tu partida" (en Editar estado y en la ficha) ----------

export function PlayDetails({ game }: { game: GameRecord }) {
  const profileId = useStore((s) => s.currentProfileId);
  const ug = useStore((s) => (profileId ? s.userGames[userGameKey(profileId, game.id)] : undefined));
  const lists = useStore((s) => s.lists);
  const items = useStore((s) => s.items);
  const userGames = useStore((s) => s.userGames);
  const updateUserGame = useStore((s) => s.updateUserGame);
  const setReplayTotal = useStore((s) => s.setReplayTotal);
  if (!profileId || !ug) return null;
  const replays = replayStats({ lists, items, userGames }, profileId, game.id);

  return (
    <View style={{ gap: 10 }}>
      <DateField
        label="Empezado"
        value={ug.startedAt}
        onChange={(startedAt) => updateUserGame(game.id, { startedAt })}
      />
      <DateField
        label="Terminado"
        value={ug.finishedAt}
        onChange={(finishedAt) => updateUserGame(game.id, { finishedAt })}
      />
      <ToggleRow
        label="Lo tengo en físico"
        caption="En caja, no solo digital"
        value={ug.owned}
        onChange={(owned) => updateUserGame(game.id, { owned })}
      />
      <ReplayTotalRow
        total={replays.total}
        fromLists={replays.fromLists}
        perList={replays.perList}
        onChange={(total) => setReplayTotal(game.id, total)}
      />
    </View>
  );
}

function ReplayTotalRow({
  total,
  fromLists,
  perList,
  onChange,
}: {
  total: number;
  fromLists: number;
  perList: { list: GameList; replays: number }[];
  onChange: (total: number) => void;
}) {
  const c = useIgnColors();
  const extra = total - fromLists;
  return (
    <View style={[styles.replayBox, { backgroundColor: c.card, borderColor: c.line, borderRadius: c.radius }]}>
      <View style={styles.replayHead}>
        <ReplayBadge count={total} size={36} />
        <View style={{ flex: 1 }}>
          <ThemedText size={14}>Veces rejugado en total</ThemedText>
          <ThemedText variant="muted" size={11}>
            {perList.length
              ? `${perList.map((p) => `${p.list.name}: ${p.replays}`).join(' · ')}${extra ? ` · fuera de listas: ${extra > 0 ? '+' : ''}${extra}` : ''}`
              : 'Súmalas en cada lista o ajusta aquí el total'}
          </ThemedText>
        </View>
        <Stepper value={total} onChange={onChange} />
      </View>
    </View>
  );
}

// ---------- Nota y rejugadas de un juego dentro de una lista ----------

export function ListItemSheet({ listId, game, onClose }: { listId: string; game: GameRecord; onClose: () => void }) {
  const c = useIgnColors();
  const item = useStore((s) => itemsOfList(s.items, listId).find((i) => i.gameId === game.id));
  const list = useStore((s) => s.lists[listId]);
  const updateListItem = useStore((s) => s.updateListItem);
  const [note, setNote] = useState(item?.note ?? '');
  if (!item || !list) return null;

  const save = () => {
    if ((item.note ?? '') !== note.trim()) updateListItem(listId, game.id, { note: note.trim() });
    onClose();
  };

  return (
    <Sheet visible title={game.title} onClose={save} doneLabel={null}>
      <View style={{ gap: 14, paddingBottom: 6 }}>
        <ThemedText variant="muted" size={12}>
          En «{list.name}»
        </ThemedText>
        <View style={[styles.replayBox, { backgroundColor: c.card, borderColor: c.line, borderRadius: c.radius }]}>
          <View style={styles.replayHead}>
            <ReplayBadge count={item.replays ?? 0} size={36} dim={!item.replays} />
            <View style={{ flex: 1 }}>
              <ThemedText size={14}>Rejugado en esta lista</ThemedText>
              <ThemedText variant="muted" size={11}>
                Se suma al total de tu biblioteca
              </ThemedText>
            </View>
            <Stepper value={item.replays ?? 0} onChange={(replays) => updateListItem(listId, game.id, { replays })} />
          </View>
        </View>
        <TextField
          label="Nota en esta lista"
          value={note}
          onChangeText={setNote}
          placeholder="Comprar la edición física, jugado en Switch…"
          multiline
          maxLength={280}
        />
        <DarkButton label="Guardar" onPress={save} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  replayBox: { padding: 12, borderWidth: StyleSheet.hairlineWidth },
  replayHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
