import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { resolveGames, toGameRecord } from '@/api/games';
import type { OnlineResult } from '@/api/types';
import { GameCover } from '@/components/games';
import { Card, DarkButton, IgnScreen, LightButton, ProgressBar, useIgnColors } from '@/components/ign';
import { Segmented } from '@/components/Segmented';
import { ThemedText } from '@/components/ThemedText';
import { TextField } from '@/components/ui';
import { STATUS_META } from '@/data/meta';
import { useStore } from '@/store/useStore';
import type { Visibility } from '@/types';
import { parseImportText, type ImportLine } from '@/utils/importText';
import { notify } from '@/utils/notify';
import { goBack } from '@/utils/nav';

type Row = { line: ImportLine; result: OnlineResult | null; include: boolean };

const EXAMPLE = `Hades | pasado | 9
Sekiro: Shadows Die Twice | 2019 | pasado
Pokémon Platinum | jugando
Jump King | en pausa
Tunic`;

// Importar una lista pegando los títulos: cada juego se busca en IGDB (o RAWG) y se añade
// con su ficha de la API, nunca como juego inventado.
export default function ImportListScreen() {
  const c = useIgnColors();
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const cancelled = useRef(false);

  const lines = useMemo(() => parseImportText(text), [text]);
  const found = rows?.filter((r) => r.result && r.include) ?? [];
  const missing = rows?.filter((r) => !r.result) ?? [];

  const search = async () => {
    setError('');
    setRows(null);
    cancelled.current = false;
    const out: Row[] = [];
    setProgress({ done: 0, total: lines.length });
    try {
      for (const line of lines) {
        if (cancelled.current) break;
        const [result] = await resolveGames([{ q: line.title, year: line.year ?? 0 }]);
        out.push({ line, result, include: !!result });
        setRows([...out]);
        setProgress({ done: out.length, total: lines.length });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  const create = () => {
    const s = useStore.getState();
    const listId = s.createList({ name: name.trim() || 'Lista importada', visibility });
    for (const row of found) {
      const record = toGameRecord(row.result!, s.currentProfileId);
      if (!useStore.getState().games[record.id]) s.upsertGame(record);
      s.addToList(listId, record.id);
      if (row.line.status) s.setStatus(record.id, row.line.status);
      if (row.line.rating) s.updateUserGame(record.id, { rating: row.line.rating });
      if (row.line.platform) s.updateUserGame(record.id, { platform: row.line.platform });
    }
    notify(`Lista creada con ${found.length} juegos`);
    router.replace(`/list/${listId}`);
  };

  const toggle = (i: number) =>
    setRows((r) => r && r.map((row, k) => (k === i ? { ...row, include: !row.include } : row)));

  return (
    <IgnScreen
      narrow={820}
      title="Importar lista"
      close
      contentStyle={{ paddingHorizontal: 20, gap: 18, paddingBottom: 60 }}
    >
      <ThemedText variant="muted" size={13}>
        Pega un juego por línea. Detrás del título puedes poner, separado con «|», el año, la plataforma, el estado
        (pasado, al 100 %, jugado, visto, jugando, en pausa, abandonado, pendiente, deseado) y tu nota del 1 al 10. Cada
        juego se busca en IGDB y se añade con su ficha oficial.
      </ThemedText>
      <TextField
        label="Nombre de la lista"
        value={name}
        onChangeText={setName}
        placeholder="2026, Juegos a comprar…"
        maxLength={60}
      />
      <Segmented
        value={visibility}
        onChange={setVisibility}
        options={[
          { value: 'private', label: '🔒 Privada' },
          { value: 'public', label: '🌐 Pública' },
        ]}
      />
      <TextField
        label={`Juegos${lines.length ? ` (${lines.length})` : ''}`}
        value={text}
        onChangeText={(t) => {
          setText(t);
          setRows(null);
        }}
        placeholder={EXAMPLE}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        style={{ minHeight: 180, textAlignVertical: 'top' }}
      />

      {progress ? (
        <Card style={{ gap: 10 }}>
          <View style={styles.row}>
            <ActivityIndicator color={c.text} />
            <ThemedText size={14} style={{ flex: 1 }}>
              Buscando en IGDB… {progress.done} de {progress.total}
            </ThemedText>
            <Pressable onPress={() => (cancelled.current = true)} hitSlop={8}>
              <ThemedText variant="bold" size={13} style={{ textDecorationLine: 'underline' }}>
                Parar
              </ThemedText>
            </Pressable>
          </View>
          <ProgressBar pct={progress.total ? Math.round((progress.done / progress.total) * 100) : 0} height={4} />
        </Card>
      ) : (
        <DarkButton
          label={rows ? 'Volver a buscar' : 'Buscar juegos'}
          icon="search"
          disabled={!lines.length}
          onPress={search}
        />
      )}
      {error ? (
        <ThemedText size={13} style={{ color: '#e5484d' }}>
          {error}
        </ThemedText>
      ) : null}

      {rows?.length ? (
        <View style={{ gap: 4 }}>
          <ThemedText variant="muted" size={12}>
            Toca un juego para quitarlo o volver a ponerlo. Si alguno no es el correcto, cambia su título o añade el año
            y vuelve a buscar.
          </ThemedText>
          {rows.map((row, i) => (
            <Pressable
              key={i}
              disabled={!row.result}
              onPress={() => toggle(i)}
              style={[styles.result, { borderBottomColor: c.line, opacity: row.result && !row.include ? 0.4 : 1 }]}
            >
              {row.result ? (
                <GameCover game={toGameRecord(row.result, null)} width={44} radius={4} />
              ) : (
                <View style={[styles.noCover, { backgroundColor: c.soft }]}>
                  <Ionicons name="help" size={20} color={c.muted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <ThemedText size={14} numberOfLines={1}>
                  {row.result ? row.result.title : row.line.title}
                </ThemedText>
                <ThemedText variant="muted" size={12} numberOfLines={1}>
                  {row.result
                    ? [row.result.year, row.result.developer, row.result.source === 'rawg' ? 'RAWG' : 'IGDB']
                        .filter(Boolean)
                        .join(' · ')
                    : 'No encontrado: no se añadirá'}
                </ThemedText>
              </View>
              {row.line.status ? (
                <ThemedText size={11} style={{ color: STATUS_META[row.line.status].color }}>
                  {STATUS_META[row.line.status].short}
                  {row.line.rating ? ` · ${row.line.rating}` : ''}
                </ThemedText>
              ) : null}
              {row.result ? (
                <Ionicons name={row.include ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={c.text} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {rows && !progress ? (
        <View style={{ gap: 10 }}>
          {missing.length ? (
            <ThemedText variant="muted" size={12}>
              {missing.length} {missing.length === 1 ? 'juego no se ha encontrado' : 'juegos no se han encontrado'} en
              la API.
            </ThemedText>
          ) : null}
          <DarkButton label={`Crear lista con ${found.length} juegos`} disabled={!found.length} onPress={create} />
          <LightButton label="Cancelar" onPress={() => goBack()} />
        </View>
      ) : null}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  noCover: { width: 44, height: 59, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});
