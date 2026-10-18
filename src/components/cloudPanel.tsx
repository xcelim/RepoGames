import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { deleteDownload, downloadProfile, downloadSize, pendingCount, syncNow, useSync } from '@/cloud/engine';
import { useOnline } from '@/cloud/net';
import { cloudConfig } from '@/cloud/supabase';
import { deleteAccount, fetchCommunity, signOutCloud } from '@/cloud/sync';
import { useStore } from '@/store/useStore';

import { Card, DarkButton, LightButton, useIgnColors } from './ign';
import { ThemedText } from './ThemedText';
import { TextField } from './ui';

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'nunca';

function mb(bytes: number) {
  return bytes < 1_000_000
    ? `${Math.max(1, Math.round(bytes / 1000))} KB`
    : `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} MB`;
}

// ---------- Tu cuenta en Supabase ----------

export function CloudAccountPanel() {
  const c = useIgnColors();
  const online = useOnline();
  const email = useStore((s) => s.cloudEmail);
  const uid = useStore((s) => s.cloudUserId);
  const lastSync = useStore((s) => s.lastSync);
  const pending = useStore(pendingCount);
  const status = useSync((s) => s.status);
  const error = useSync((s) => s.error);
  const cloudUrl = useStore((s) => s.cloudUrl);
  const cloudAnonKey = useStore((s) => s.cloudAnonKey);
  const setCloudConfig = useStore((s) => s.setCloudConfig);
  const [url, setUrl] = useState(cloudUrl);
  const [key, setKey] = useState(cloudAnonKey);
  const [msg, setMsg] = useState('');
  const configured = cloudConfig() !== null;

  if (!configured) {
    return (
      <Card style={{ gap: 10 }}>
        <ThemedText variant="bold" size={15}>
          Supabase no está configurado
        </ThemedText>
        <ThemedText variant="muted" size={13}>
          Esta versión se compiló sin la URL y la clave de tu proyecto, así que todo se guarda solo en este móvil. Lo
          normal es ponerlas como secretos en GitHub (SUPABASE_URL y SUPABASE_ANON_KEY) y volver a compilar. Para probar
          ya, pégalas aquí:
        </ThemedText>
        <TextField
          value={url}
          onChangeText={setUrl}
          placeholder="https://xxxx.supabase.co"
          autoCapitalize="none"
          keyboardType="url"
        />
        <TextField value={key} onChangeText={setKey} placeholder="Clave anon public" autoCapitalize="none" />
        <DarkButton
          label="Conectar con Supabase"
          onPress={() => {
            setCloudConfig(url, key);
            if (url && key) router.replace('/welcome');
          }}
        />
      </Card>
    );
  }

  const confirmSignOut = () =>
    Alert.alert(
      'Cerrar sesión',
      'Tus datos siguen guardados en tu cuenta. En este móvil se borrarán hasta que vuelvas a entrar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOutCloud();
              router.replace('/welcome');
            } catch (e) {
              Alert.alert('No se puede cerrar sesión todavía', e instanceof Error ? e.message : String(e), [
                { text: 'Esperar', style: 'cancel' },
                {
                  text: 'Cerrar igualmente (se pierden)',
                  style: 'destructive',
                  onPress: async () => {
                    await signOutCloud(true);
                    router.replace('/welcome');
                  },
                },
              ]);
            }
          },
        },
      ],
    );

  const confirmDelete = () =>
    Alert.alert(
      'Borrar mi cuenta',
      'Se borrarán para siempre tu perfil, tus listas, tu biblioteca y tus reseñas. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              router.replace('/welcome');
            } catch (e) {
              Alert.alert('No se pudo borrar', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );

  return (
    <Card style={{ gap: 12 }}>
      <View style={styles.row}>
        <Ionicons name={online ? 'cloud-done-outline' : 'cloud-offline-outline'} size={26} color={c.text} />
        <View style={{ flex: 1 }}>
          <ThemedText variant="bold" size={15}>
            {uid ? (email ?? 'Sesión iniciada') : 'Sin sesión'}
          </ThemedText>
          <ThemedText variant="muted" size={12}>
            {!online
              ? 'Sin conexión: los cambios se subirán al volver internet.'
              : status === 'syncing'
                ? 'Sincronizando…'
                : `Guardado en Supabase · última vez ${fmtDate(lastSync)}`}
          </ThemedText>
        </View>
        {status === 'syncing' ? <ActivityIndicator color={c.text} /> : null}
      </View>
      {pending ? (
        <ThemedText size={13}>
          {pending} {pending === 1 ? 'cambio pendiente' : 'cambios pendientes'} de subir.
        </ThemedText>
      ) : null}
      {status === 'error' && error ? (
        <ThemedText size={12} style={{ color: '#e5484d' }}>
          Último error: {error}
        </ThemedText>
      ) : null}
      {uid ? (
        <>
          <DarkButton
            label="Sincronizar ahora"
            icon="sync"
            disabled={!online}
            onPress={async () => {
              setMsg('');
              await syncNow();
              await fetchCommunity();
              setMsg(useSync.getState().status === 'error' ? '' : 'Todo al día.');
            }}
          />
          {msg ? (
            <ThemedText variant="muted" size={12}>
              {msg}
            </ThemedText>
          ) : null}
          <LightButton label="Cerrar sesión" onPress={confirmSignOut} />
          <ThemedText variant="muted" size={12} style={styles.link} onPress={online ? confirmDelete : undefined}>
            Borrar mi cuenta y todos mis datos
          </ThemedText>
        </>
      ) : (
        <DarkButton label="Entrar o crear cuenta" onPress={() => router.push('/welcome')} />
      )}
    </Card>
  );
}

// ---------- Descargar tu perfil para usarlo sin conexión (opcional) ----------

export function OfflineDownloadCard() {
  const c = useIgnColors();
  const online = useOnline();
  const enabled = useStore((s) => s.offlineEnabled);
  const downloadedAt = useStore((s) => s.downloadedAt);
  const uid = useStore((s) => s.cloudUserId);
  const progress = useSync((s) => s.download);
  const [size, setSize] = useState<{ games: number; bytes: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    downloadSize()
      .then((r) => alive && setSize(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [enabled, downloadedAt, progress]);

  if (!uid || cloudConfig() === null) return null;

  const start = async () => {
    setError('');
    try {
      await downloadProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      useSync.setState({ download: null });
    }
  };

  const remove = () =>
    Alert.alert(
      'Borrar la descarga',
      'Se borrará del móvil la copia de tus listas, fichas y portadas. Tus datos siguen en tu cuenta. Sin conexión ya no podrás ver tu perfil.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar descarga',
          style: 'destructive',
          onPress: () => deleteDownload().then(() => setError('')),
        },
      ],
    );

  return (
    <Card style={{ gap: 12 }}>
      <View style={styles.row}>
        <Ionicons
          name={enabled ? 'checkmark-circle' : 'download-outline'}
          size={26}
          color={enabled ? '#6aa834' : c.text}
        />
        <View style={{ flex: 1 }}>
          <ThemedText variant="display" size={18}>
            Usar sin conexión
          </ThemedText>
          <ThemedText variant="muted" size={12}>
            {progress
              ? 'Descargando tu perfil…'
              : enabled
                ? `${downloadedAt ? `Descargado · ${fmtDate(downloadedAt)}` : 'Descarga sin terminar: pulsa «Actualizar descarga»'}${size ? ` · ${size.games} juegos · ${mb(size.bytes)} aprox.` : ''}`
                : 'Opcional. Guarda en el móvil tus listas, tu biblioteca, las fichas y las portadas para verlas y gestionarlas sin internet.'}
          </ThemedText>
        </View>
      </View>
      {progress ? (
        <View style={{ gap: 6 }}>
          <View style={[styles.track, { backgroundColor: c.soft }]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                  backgroundColor: c.text,
                },
              ]}
            />
          </View>
          <ThemedText variant="muted" size={12}>
            Descargando {progress.done} de {progress.total} juegos…
          </ThemedText>
        </View>
      ) : enabled ? (
        <>
          <ThemedText variant="muted" size={12}>
            Se mantiene al día sola mientras tengas conexión. Los juegos nuevos que añadas se guardan también.
          </ThemedText>
          <LightButton label="Actualizar descarga (fichas y portadas nuevas)" onPress={start} />
          <LightButton label="Borrar la descarga y liberar espacio" onPress={remove} />
        </>
      ) : (
        <DarkButton
          label={online ? 'Descargar mi perfil' : 'Necesitas conexión para descargarlo'}
          icon="download-outline"
          disabled={!online}
          onPress={start}
        />
      )}
      {error ? (
        <ThemedText size={12} style={{ color: '#e5484d' }}>
          {error}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  link: { textDecorationLine: 'underline', textAlign: 'center', marginTop: 4 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%' },
});
