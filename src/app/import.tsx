import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { resolveGames, toGameRecord } from '@/api/games';
import type { OnlineResult } from '@/api/types';
import { GameCover } from '@/components/games';
import { Card, DarkButton, IgnScreen, LightButton, ProgressBar, ToggleRow, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { TextField } from '@/components/ui';
import { STATUS_META } from '@/data/meta';
import { useStore } from '@/store/useStore';
import type { PlayStatus } from '@/types';
import { parseImportText } from '@/utils/importText';
import { userGameKey } from '@/utils/library';
import { notify } from '@/utils/notify';
import {
  detectPreset,
  guessMapping,
  parseCsv,
  parseXlsx,
  PRESET_LABEL,
  readEntries,
  toTable,
  type Mapping,
  type Preset,
  type Table,
  type TableEntry,
} from '@/utils/tableImport';

type Row = { entry: TableEntry; result: OnlineResult | null; include: boolean };
const MAX = 2000;
const DEFAULTS: PlayStatus[] = ['library', 'backlog', 'beaten', 'wishlist'];
type Field = 'title' | 'status' | 'rating' | 'hours' | 'platform' | 'finished';
const FIELDS: { id: Field; label: string }[] = [
  { id: 'title', label: 'Título' },
  { id: 'status', label: 'Estado' },
  { id: 'rating', label: 'Nota' },
  { id: 'hours', label: 'Horas' },
  { id: 'platform', label: 'Plataforma' },
  { id: 'finished', label: 'Terminado el' },
];

async function readPicked(asset: DocumentPicker.DocumentPickerAsset): Promise<string[][]> {
  const isXlsx = /\.xlsx$/i.test(asset.name) || /spreadsheetml/.test(asset.mimeType ?? '');
  if (/\.xls$/i.test(asset.name))
    throw new Error('Guarda el Excel como .xlsx o .csv (el formato .xls antiguo no se puede leer)');
  if (Platform.OS === 'web') {
    const file = asset.file;
    if (!file) throw new Error('No he podido abrir el archivo');
    return isXlsx ? parseXlsx(new Uint8Array(await file.arrayBuffer())) : parseCsv(await file.text());
  }
  const { File } = await import('expo-file-system');
  const f = new File(asset.uri);
  return isXlsx ? parseXlsx(await f.bytes()) : parseCsv(await f.text());
}

// Importar desde cualquier sitio: Steam, una tabla (CSV o Excel) de otra app o una lista pegada.
export default function ImportScreen() {
  const c = useIgnColors();
  const [source, setSource] = useState<string | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [preset, setPreset] = useState<Preset>('generic');
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState('');
  const [fallback, setFallback] = useState<PlayStatus>('library');
  const [updateExisting, setUpdateExisting] = useState(true);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const stop = useRef(false);

  const entries = useMemo<TableEntry[]>(() => {
    if (paste)
      return parseImportText(text).map((l) => ({
        title: l.title,
        status: l.status,
        rating: l.rating,
        year: l.year,
        platform: l.platform,
        hours: null,
        finishedAt: null,
        review: null,
      }));
    return table && mapping ? readEntries(table, mapping, preset).slice(0, MAX) : [];
  }, [paste, text, table, mapping, preset]);

  const pick = async () => {
    setError('');
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'text/plain',
          'text/tab-separated-values',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '*/*',
        ],
        copyToCacheDirectory: true,
        base64: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const t = toTable(await readPicked(asset));
      if (!t.rows.length) throw new Error('El archivo está vacío');
      setTable(t);
      setPreset(detectPreset(t));
      setMapping(guessMapping(t));
      setSource(asset.name);
      setPaste(false);
      setRows(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Toca un campo para cambiar la columna que usa (o quitarla).
  const cycle = (field: Field) => {
    if (!table || !mapping) return;
    const n = table.headers.length;
    const current = mapping[field];
    const next =
      field === 'title' ? ((current ?? 0) + 1) % n : current == null ? 0 : current + 1 >= n ? null : current + 1;
    setMapping({ ...mapping, [field]: next });
    setRows(null);
  };

  const search = async () => {
    setError('');
    stop.current = false;
    const out: Row[] = [];
    setRows([]);
    setProgress({ done: 0, total: entries.length });
    try {
      for (let i = 0; i < entries.length; i += 8) {
        if (stop.current) break;
        const chunk = entries.slice(i, i + 8);
        const found = await resolveGames(chunk.map((e) => ({ q: e.title, year: e.year ?? 0 })));
        chunk.forEach((entry, k) => out.push({ entry, result: found[k], include: !!found[k] }));
        setRows([...out]);
        setProgress({ done: out.length, total: entries.length });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  const chosen = rows?.filter((r) => r.result && r.include) ?? [];
  const missing = rows?.filter((r) => !r.result) ?? [];

  const doImport = () => {
    const s = useStore.getState();
    const pid = s.currentProfileId;
    if (!pid) return;
    let added = 0;
    let updated = 0;
    const seen = new Set<string>();
    for (const row of chosen) {
      const record = toGameRecord(row.result!, pid);
      if (seen.has(record.id)) continue;
      seen.add(record.id);
      if (!useStore.getState().games[record.id]) s.upsertGame(record);
      const existing = useStore.getState().userGames[userGameKey(pid, record.id)];
      if (existing && !updateExisting) continue;
      const e = row.entry;
      const status = e.status ?? (existing ? null : fallback);
      if (status && status !== existing?.status) s.setStatus(record.id, status);
      const patch: Parameters<typeof s.updateUserGame>[1] = {};
      if (e.rating != null) patch.rating = e.rating;
      if (e.hours != null && e.hours > (existing?.hoursPlayed ?? 0)) patch.hoursPlayed = e.hours;
      if (e.platform && !existing?.platform) patch.platform = e.platform;
      if (e.finishedAt && !existing?.finishedAt) patch.finishedAt = e.finishedAt;
      if (e.review && !existing?.review) patch.review = e.review;
      if (Object.keys(patch).length) s.updateUserGame(record.id, patch);
      if (existing) updated++;
      else added++;
    }
    notify(`Importado: ${added} juegos nuevos${updated ? ` y ${updated} actualizados` : ''}`);
    router.replace('/library');
  };

  const toggle = (i: number) =>
    setRows((r) => r && r.map((row, k) => (k === i ? { ...row, include: !row.include } : row)));

  return (
    <IgnScreen title="Importar" back contentStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 60 }}>
      <ThemedText variant="muted" size={13}>
        Trae tu colección desde donde la tengas. Cada juego se busca en IGDB y se añade con su ficha oficial.
      </ThemedText>

      <View style={styles.sources}>
        <Source icon="logo-steam" title="Steam" text="Juegos, horas y logros" onPress={() => router.push('/steam')} />
        <Source icon="document-text" title="Archivo" text="CSV o Excel" onPress={pick} active={!!table && !paste} />
        <Source
          icon="clipboard"
          title="Pegar"
          text="Una lista de títulos"
          onPress={() => {
            setPaste(true);
            setRows(null);
          }}
          active={paste}
        />
      </View>

      <Card style={{ gap: 6 }}>
        <ThemedText variant="bold" size={13}>
          Desde otras apps
        </ThemedText>
        <ThemedText variant="muted" size={12}>
          HowLongToBeat, Backloggd, Grouvee, Playnite, Exophase, GG, tu propia hoja de cálculo… exporta tu colección
          como CSV o Excel y súbela con «Archivo»: adivino qué columna es cada cosa. PlayStation, Xbox y Nintendo no
          dejan que otras apps lean tu biblioteca, así que para ellas usa una de esas apps o pega la lista.
        </ThemedText>
      </Card>

      {error ? (
        <ThemedText size={13} style={{ color: '#e5484d' }}>
          {error}
        </ThemedText>
      ) : null}

      {paste ? (
        <ThemedText variant="muted" size={12}>
          Un juego por línea: «Título | plataforma | estado | nota». Todo menos el título es opcional y puede ir en
          cualquier orden. Estados: pasado (o completado), al 100 %, jugado, visto, jugando, en pausa, abandonado,
          pendiente, deseado.
        </ThemedText>
      ) : null}
      {paste ? (
        <TextField
          label={`Juegos${entries.length ? ` (${entries.length})` : ''}`}
          value={text}
          onChangeText={(t) => {
            setText(t);
            setRows(null);
          }}
          placeholder={'Hades | PC | pasado | 9\nZelda II | NES | visto | 6\nTunic | pendiente\nCeleste (2018)'}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          style={{ minHeight: 160, textAlignVertical: 'top' }}
        />
      ) : null}

      {table && mapping && !paste ? (
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="checkmark-circle" size={18} color={c.accent} />
            <ThemedText variant="bold" size={14} style={{ flex: 1 }} numberOfLines={1}>
              {`${source} · ${PRESET_LABEL[preset]} · ${table.rows.length} filas`}
            </ThemedText>
          </View>
          <ThemedText variant="muted" size={12}>
            Toca un campo para cambiar la columna de la que sale.
          </ThemedText>
          <View style={styles.chips}>
            {FIELDS.map((f) => {
              const col = mapping[f.id];
              return (
                <Pressable
                  key={f.id}
                  onPress={() => cycle(f.id)}
                  style={[styles.chip, { borderColor: col == null ? c.line : c.text, borderRadius: c.radius }]}
                >
                  <ThemedText variant="bold" size={11}>
                    {f.label}
                  </ThemedText>
                  <ThemedText variant="muted" size={11} numberOfLines={1}>
                    {col == null
                      ? f.id === 'status' && mapping.statusColumns.length
                        ? 'columnas sí/no'
                        : '—'
                      : table.headers[col]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ gap: 4 }}>
              {entries.slice(0, 4).map((e, i) => (
                <ThemedText key={i} size={12} numberOfLines={1}>
                  {`• ${e.title}${e.status ? ` · ${STATUS_META[e.status].label}` : ''}${e.rating ? ` · ${e.rating}/10` : ''}${
                    e.hours ? ` · ${e.hours} h` : ''
                  }`}
                </ThemedText>
              ))}
            </View>
          </ScrollView>
        </Card>
      ) : null}

      {entries.length ? (
        <>
          <View style={{ gap: 8 }}>
            <ThemedText variant="bold" size={13}>
              Si un juego no dice su estado, ponerlo en…
            </ThemedText>
            <View style={styles.chips}>
              {DEFAULTS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setFallback(s)}
                  style={[
                    styles.pill,
                    { borderRadius: c.radius, backgroundColor: fallback === s ? c.inverseBg : c.soft },
                  ]}
                >
                  <ThemedText variant="bold" size={12} style={{ color: fallback === s ? c.inverseText : c.text }}>
                    {STATUS_META[s].label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
          <ToggleRow
            label="Actualizar los que ya tengo"
            caption="Pone el estado, la nota y las horas del archivo a los juegos que ya estaban en tu biblioteca"
            value={updateExisting}
            onChange={setUpdateExisting}
          />
          {progress ? (
            <Card style={{ gap: 10 }}>
              <View style={styles.row}>
                <ActivityIndicator color={c.text} />
                <ThemedText size={14} style={{ flex: 1 }}>
                  {`Buscando en IGDB… ${progress.done} de ${progress.total}`}
                </ThemedText>
                <Pressable onPress={() => (stop.current = true)} hitSlop={8}>
                  <ThemedText variant="bold" size={13} style={{ textDecorationLine: 'underline' }}>
                    Parar
                  </ThemedText>
                </Pressable>
              </View>
              <ProgressBar pct={progress.total ? Math.round((progress.done / progress.total) * 100) : 0} height={4} />
            </Card>
          ) : rows && rows.length ? (
            <DarkButton
              label={`Importar ${chosen.length} juegos`}
              icon="download"
              disabled={!chosen.length}
              onPress={doImport}
            />
          ) : (
            <DarkButton label={`Buscar ${entries.length} juegos`} icon="search" onPress={search} />
          )}
        </>
      ) : null}

      {rows && rows.length ? (
        <View style={{ gap: 8 }}>
          <ThemedText variant="muted" size={13}>
            {`${rows.length - missing.length} encontrados${missing.length ? ` · ${missing.length} sin encontrar` : ''}. Toca uno para quitarlo.`}
          </ThemedText>
          {rows.map((r, i) => (
            <Pressable key={i} onPress={() => r.result && toggle(i)}>
              <Card style={[styles.row, { opacity: r.result && r.include ? 1 : 0.45 }]}>
                {r.result ? (
                  <GameCover game={toGameRecord(r.result, null)} width={38} plain />
                ) : (
                  <Ionicons name="help-circle" size={32} color={c.muted} />
                )}
                <View style={{ flex: 1 }}>
                  <ThemedText variant="bold" size={13} numberOfLines={1}>
                    {r.result?.title ?? r.entry.title}
                  </ThemedText>
                  <ThemedText variant="muted" size={11} numberOfLines={1}>
                    {r.result
                      ? `${r.result.year ?? ''}${r.result.title !== r.entry.title ? ` · «${r.entry.title}»` : ''}`
                      : `No encontrado: «${r.entry.title}»`}
                  </ThemedText>
                </View>
                {r.result ? (
                  <Ionicons
                    name={r.include ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={r.include ? c.accent : c.muted}
                  />
                ) : null}
              </Card>
            </Pressable>
          ))}
          {chosen.length && !progress ? (
            <LightButton label={`Importar ${chosen.length} juegos`} onPress={doImport} />
          ) : null}
        </View>
      ) : null}
    </IgnScreen>
  );
}

function Source({
  icon,
  title,
  text,
  onPress,
  active,
}: {
  icon: string;
  title: string;
  text: string;
  onPress: () => void;
  active?: boolean;
}) {
  const c = useIgnColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.source,
        { backgroundColor: active ? c.inverseBg : c.card, borderColor: c.line, borderRadius: c.radius },
      ]}
    >
      <Ionicons name={icon as never} size={26} color={active ? c.inverseText : c.text} />
      <ThemedText variant="bold" size={14} style={{ color: active ? c.inverseText : c.text }}>
        {title}
      </ThemedText>
      <ThemedText size={11} style={{ color: active ? c.inverseText : c.muted, textAlign: 'center' }}>
        {text}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sources: { flexDirection: 'row', gap: 10 },
  source: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 16, paddingHorizontal: 6, borderWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 160 },
  pill: { paddingHorizontal: 12, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
