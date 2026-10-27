import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { isAdmin } from '@/api/officialDb';
import { getMinBuild, loadReports, setMinBuild, setReportStatus, type Report } from '@/cloud/moderation';
import { ensureProfiles, useSocial } from '@/cloud/social';
import { Card, DarkButton, IgnScreen, LightButton, timeAgo, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { TextField } from '@/components/ui';
import { BUILD } from '@/utils/appUpdate';
import { notify } from '@/utils/notify';

// Panel de administración: denuncias y versión mínima obligatoria de la app.
export default function AdminScreen() {
  const c = useIgnColors();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [min, setMin] = useState('');
  const [message, setMessage] = useState('');
  const profiles = useSocial(useShallow((s) => s.profiles));

  const load = useCallback(async () => {
    const ok = await isAdmin().catch(() => false);
    setAdmin(ok);
    if (!ok) return;
    const [list, cfg] = await Promise.all([loadReports().catch(() => []), getMinBuild().catch(() => null)]);
    setReports(list);
    if (cfg) {
      setMin(String(cfg.build));
      setMessage(cfg.message);
    }
    await ensureProfiles(list.flatMap((r) => [r.reporter, r.target ?? '']).filter(Boolean));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      load().catch(() => setAdmin(false));
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const mark = async (r: Report, status: Report['status']) => {
    await setReportStatus(r.id, status).catch((e: Error) => notify(e.message));
    setReports((l) => l?.map((x) => (x.id === r.id ? { ...x, status } : x)) ?? null);
  };

  const shown = (reports ?? []).filter((r) => filter === 'all' || r.status === 'open');
  const name = (id: string | null) => (id ? (profiles[id]?.displayName ?? 'Alguien') : '—');

  return (
    <IgnScreen
      title="Administración"
      back
      narrow={860}
      onRefresh={load}
      contentStyle={{ paddingHorizontal: 20, gap: 16 }}
    >
      {admin === null ? <ActivityIndicator color={c.text} /> : null}
      {admin === false ? (
        <Card>
          <ThemedText variant="muted">Solo para administradores.</ThemedText>
        </Card>
      ) : null}
      {admin ? (
        <>
          <Card style={{ gap: 10 }}>
            <ThemedText variant="display" size={19}>
              Actualización obligatoria
            </ThemedText>
            <ThemedText variant="muted" size={13}>
              {`Las APK con un número de compilación menor que este tendrán que actualizar para seguir usando la app (0 = ninguna). La tuya es la ${BUILD || '—'}.`}
            </ThemedText>
            <TextField label="Compilación mínima" value={min} onChangeText={setMin} keyboardType="number-pad" />
            <TextField
              label="Mensaje (opcional)"
              value={message}
              onChangeText={setMessage}
              placeholder="Esta versión ya no es compatible…"
              multiline
            />
            <DarkButton
              label="Guardar"
              icon="save"
              onPress={() =>
                setMinBuild(Math.max(0, Number(min) || 0), message.trim())
                  .then(() => notify('Guardado'))
                  .catch((e: Error) => notify(e.message))
              }
            />
          </Card>

          <View style={styles.row}>
            <ThemedText variant="display" size={19} style={{ flex: 1 }}>
              Denuncias
            </ThemedText>
            {(['open', 'all'] as const).map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.chip, { backgroundColor: filter === f ? c.inverseBg : c.soft, borderRadius: c.radius }]}
              >
                <ThemedText variant="bold" size={12} style={{ color: filter === f ? c.inverseText : c.text }}>
                  {f === 'open' ? 'Abiertas' : 'Todas'}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          {reports && !shown.length ? (
            <Card>
              <ThemedText variant="muted">No hay denuncias {filter === 'open' ? 'abiertas' : ''}.</ThemedText>
            </Card>
          ) : null}
          {shown.map((r) => (
            <Card key={r.id} style={{ gap: 8, opacity: r.status === 'open' ? 1 : 0.55 }}>
              <Pressable onPress={() => r.target && router.push(`/user/${r.target}`)}>
                <ThemedText variant="bold" size={15}>{`${name(r.target)} · ${r.reason}`}</ThemedText>
              </Pressable>
              <ThemedText variant="muted" size={12}>
                {`Denunciado por ${name(r.reporter)} · ${timeAgo(r.createdAt)} · ${r.status === 'open' ? 'abierta' : r.status === 'done' ? 'resuelta' : 'descartada'}`}
              </ThemedText>
              {r.status === 'open' ? (
                <View style={styles.row}>
                  <DarkButton label="Resuelta" onPress={() => mark(r, 'done')} style={{ flex: 1 }} />
                  <LightButton label="Descartar" onPress={() => mark(r, 'dismissed')} style={{ flex: 1 }} />
                </View>
              ) : null}
            </Card>
          ))}
          <ThemedText variant="muted" size={12}>
            Para echar a alguien de verdad, bórralo en Supabase (Authentication → Users): se borran sus datos.
          </ThemedText>
        </>
      ) : null}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7 },
});
