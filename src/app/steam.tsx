import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { resolveGames, toGameRecord } from '@/api/games';
import { igdbBySteamAppIds } from '@/api/igdb';
import {
  hasSteam,
  resolveSteamId,
  steamOwnedGames,
  steamPlayerAchievements,
  steamProfile,
  type SteamGame,
} from '@/api/steam';
import type { OnlineResult } from '@/api/types';
import { celebrate } from '@/components/Celebration';
import { Card, DarkButton, IgnScreen, LightButton, ProgressBar, ToggleRow, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { TextField } from '@/components/ui';
import { useCurrentProfile, useStore } from '@/store/useStore';
import { userGameKey } from '@/utils/library';

type Match = { steam: SteamGame; result: OnlineResult | null };
type Phase = 'idle' | 'loading' | 'preview' | 'importing' | 'done';

// Importar tu biblioteca de Steam: juegos, horas jugadas y logros.
export default function SteamScreen() {
  const c = useIgnColors();
  const profile = useCurrentProfile();
  const updateProfile = useStore((s) => s.updateProfile);
  const [input, setInput] = useState(profile?.steamId ?? '');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [who, setWho] = useState<{ id: string; name: string; avatar: string | null } | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [step, setStep] = useState({ done: 0, total: 0, label: '' });
  const [withAch, setWithAch] = useState(true);
  const [withUnplayed, setWithUnplayed] = useState(false);
  const [summary, setSummary] = useState({ added: 0, hours: 0, achievements: 0, platinums: 0 });
  const stop = useRef(false);

  const found = matches.filter((m) => m.result);
  const played = found.filter((m) => m.steam.minutes > 0);
  const totalHours = useMemo(() => Math.round(matches.reduce((a, m) => a + m.steam.minutes, 0) / 60), [matches]);

  const search = async () => {
    setError('');
    setPhase('loading');
    try {
      setStep({ done: 0, total: 3, label: 'Buscando tu perfil de Steam…' });
      const id = await resolveSteamId(input);
      const p = await steamProfile(id);
      setWho({ id, name: p?.name ?? id, avatar: p?.avatar ?? null });
      setStep({ done: 1, total: 3, label: 'Descargando tu biblioteca…' });
      const games = (await steamOwnedGames(id)).sort((a, b) => b.minutes - a.minutes);
      setStep({ done: 2, total: 3, label: `Buscando tus ${games.length} juegos en IGDB…` });
      const byApp = await igdbBySteamAppIds(games.map((g) => g.appid));
      let list: Match[] = games.map((g) => ({ steam: g, result: byApp.get(g.appid) ?? null }));
      // Los que IGDB no enlaza con Steam, se buscan por nombre (solo los jugados, para no tardar).
      const missing = list.filter((m) => !m.result && m.steam.minutes > 0).slice(0, 40);
      for (let i = 0; i < missing.length; i++) {
        setStep({ done: 2, total: 3, label: `Buscando por nombre ${i + 1}/${missing.length}…` });
        const [r] = await resolveGames([{ q: missing[i].steam.name, year: 0 }]).catch(() => [null]);
        if (r) list = list.map((m) => (m === missing[i] ? { ...m, result: r } : m));
      }
      setMatches(list);
      setPhase('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setPhase('idle');
    }
  };

  const runImport = async () => {
    if (!who) return;
    stop.current = false;
    setPhase('importing');
    const s = useStore.getState();
    const pid = s.currentProfileId;
    if (!pid) return;
    const chosen = found.filter((m) => withUnplayed || m.steam.minutes > 0);
    let added = 0;
    let hours = 0;
    let achievements = 0;
    let platinums = 0;
    for (let i = 0; i < chosen.length; i++) {
      if (stop.current) break;
      const m = chosen[i];
      setStep({ done: i, total: chosen.length, label: m.steam.name });
      const record = toGameRecord(m.result!, pid);
      if (!useStore.getState().games[record.id]) s.upsertGame(record);
      const key = userGameKey(pid, record.id);
      const existing = useStore.getState().userGames[key];
      const h = Math.round((m.steam.minutes / 60) * 10) / 10;
      if (!existing) {
        s.setStatus(record.id, m.steam.minutes > 0 ? 'library' : 'backlog');
        added++;
      }
      const patch: Parameters<typeof s.updateUserGame>[1] = { platform: existing?.platform ?? 'PC (Steam)' };
      if (h > (existing?.hoursPlayed ?? 0)) {
        patch.hoursPlayed = h;
        hours += h - (existing?.hoursPlayed ?? 0);
      }
      if (withAch && m.steam.minutes > 0) {
        const ach = await steamPlayerAchievements(who.id, m.steam.appid);
        if (ach && ach.ids.length) {
          const merged = [...new Set([...(existing?.achievements ?? []), ...ach.ids])];
          achievements += merged.length - (existing?.achievements?.length ?? 0);
          patch.achievements = merged;
          if (ach.total > 0 && ach.ids.length === ach.total) platinums++;
        }
      }
      s.updateUserGame(record.id, patch);
    }
    updateProfile({ steamId: who.id });
    setSummary({ added, hours: Math.round(hours), achievements, platinums });
    setPhase('done');
    if (platinums)
      celebrate({
        kind: 'platinum',
        title: `${platinums} ${platinums === 1 ? 'platino importado' : 'platinos importados'} de Steam`,
      });
  };

  if (!hasSteam()) {
    return (
      <IgnScreen narrow={820} title="Steam" back contentStyle={{ paddingHorizontal: 20 }}>
        <ThemedText variant="muted">Esta versión de la app no tiene la clave de Steam.</ThemedText>
      </IgnScreen>
    );
  }

  return (
    <IgnScreen narrow={820} title="Importar de Steam" back contentStyle={{ paddingHorizontal: 20, gap: 16 }}>
      <ThemedText variant="muted" size={13}>
        Trae tus juegos de Steam con sus horas jugadas y los logros que ya tienes. Tu perfil de Steam tiene que ser
        público (Steam → tu perfil → Editar perfil → Privacidad → «Detalles del juego: Público»).
      </ThemedText>

      {phase === 'idle' || phase === 'loading' ? (
        <>
          <TextField
            label="Tu perfil de Steam"
            value={input}
            onChangeText={setInput}
            placeholder="steamcommunity.com/id/tunombre, o tu ID de 17 cifras"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <DarkButton
            label={phase === 'loading' ? 'Buscando…' : 'Buscar mi biblioteca'}
            icon="logo-steam"
            disabled={!input.trim() || phase === 'loading'}
            onPress={search}
          />
        </>
      ) : null}

      {phase === 'loading' || phase === 'importing' ? (
        <Card style={{ gap: 10 }}>
          <View style={styles.row}>
            <ActivityIndicator color={c.text} />
            <ThemedText size={13} style={{ flex: 1 }} numberOfLines={1}>
              {phase === 'importing' ? `Importando ${step.done + 1} de ${step.total}: ${step.label}` : step.label}
            </ThemedText>
          </View>
          <ProgressBar pct={step.total ? (step.done / step.total) * 100 : 0} height={6} />
          {phase === 'importing' ? <LightButton label="Parar" onPress={() => (stop.current = true)} /> : null}
        </Card>
      ) : null}

      {error ? (
        <ThemedText size={13} style={{ color: '#e5484d' }}>
          {error}
        </ThemedText>
      ) : null}

      {who && (phase === 'preview' || phase === 'done') ? (
        <Card style={styles.row}>
          {who.avatar ? (
            <Image source={{ uri: who.avatar }} style={styles.avatar} />
          ) : (
            <Ionicons name="logo-steam" size={44} color={c.text} />
          )}
          <View style={{ flex: 1 }}>
            <ThemedText variant="bold" size={16}>
              {who.name}
            </ThemedText>
            <ThemedText variant="muted" size={12}>
              {matches.length} juegos · {totalHours.toLocaleString('es-ES')} h en Steam
            </ThemedText>
          </View>
        </Card>
      ) : null}

      {phase === 'preview' ? (
        <>
          <Card style={{ gap: 6 }}>
            <ThemedText size={14}>
              ✅ {found.length} encontrados en IGDB ({played.length} jugados)
            </ThemedText>
            {matches.length - found.length ? (
              <ThemedText variant="muted" size={12}>
                {matches.length - found.length} no se han encontrado (herramientas, demos, software…): no se importan.
              </ThemedText>
            ) : null}
          </Card>
          <ToggleRow
            label="Importar mis logros"
            caption="Se marcan los que ya tienes en Steam (pueden salir platinos)"
            value={withAch}
            onChange={setWithAch}
          />
          <ToggleRow
            label="Incluir los que no he jugado"
            caption="Entran como «Pendientes»"
            value={withUnplayed}
            onChange={setWithUnplayed}
          />
          <ThemedText variant="muted" size={12}>
            Los juegos que ya tengas en tu biblioteca no cambian de estado: solo se actualizan las horas (si en Steam
            llevas más) y se añaden los logros.
          </ThemedText>
          <DarkButton
            label={`Importar ${withUnplayed ? found.length : played.length} juegos`}
            icon="download-outline"
            onPress={runImport}
          />
          <View>
            {found.slice(0, 30).map((m) => (
              <View key={m.steam.appid} style={[styles.game, { borderBottomColor: c.line }]}>
                {m.steam.icon ? (
                  <Image source={{ uri: m.steam.icon }} style={styles.icon} />
                ) : (
                  <View style={styles.icon} />
                )}
                <ThemedText size={13} style={{ flex: 1 }} numberOfLines={1}>
                  {m.result!.title}
                </ThemedText>
                <ThemedText variant="muted" size={12}>
                  {Math.round(m.steam.minutes / 60)} h
                </ThemedText>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {phase === 'done' ? (
        <Card style={{ gap: 8 }}>
          <ThemedText variant="display" size={20}>
            ¡Importado!
          </ThemedText>
          <ThemedText size={14}>🎮 {summary.added} juegos nuevos en tu biblioteca</ThemedText>
          <ThemedText size={14}>⏱️ {summary.hours.toLocaleString('es-ES')} horas apuntadas</ThemedText>
          {withAch ? <ThemedText size={14}>🏅 {summary.achievements} logros marcados</ThemedText> : null}
          {summary.platinums ? (
            <ThemedText size={14}>🏆 {summary.platinums} juegos con todos los logros</ThemedText>
          ) : null}
          <LightButton label="Volver a importar" onPress={() => setPhase('idle')} />
        </Card>
      ) : null}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 8 },
  game: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 28, height: 28, borderRadius: 4 },
});
