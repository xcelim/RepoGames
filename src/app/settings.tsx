import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clearIgdbCache, getCredentials, saveCredentials, testConnection } from '@/api/igdb';
import { cloudConfig } from '@/cloud/supabase';
import { fetchCommunity, pullAll, pushAll, signIn, signOutCloud, signUp } from '@/cloud/sync';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/lists';
import { Section } from '@/components/Section';
import { Segmented } from '@/components/Segmented';
import { SkinPicker } from '@/components/SkinPicker';
import { ThemedText } from '@/components/ThemedText';
import { Panel, TextField } from '@/components/ui';
import { useStore } from '@/store/useStore';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const mode = useStore((s) => s.durationMode);
  const setMode = useStore((s) => s.setDurationMode);
  const cloudUrl = useStore((s) => s.cloudUrl);
  const cloudAnonKey = useStore((s) => s.cloudAnonKey);
  const cloudUserId = useStore((s) => s.cloudUserId);
  const cloudProfileId = useStore((s) => s.cloudProfileId);
  const currentProfileId = useStore((s) => s.currentProfileId);
  const lastSync = useStore((s) => s.lastSync);
  const setCloudConfig = useStore((s) => s.setCloudConfig);
  const importSnapshot = useStore((s) => s.importSnapshot);
  const resetAll = useStore((s) => s.resetAll);

  // IGDB
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const [igdbStatus, setIgdbStatus] = useState('');
  useEffect(() => {
    getCredentials().then((saved) => {
      if (saved) {
        setClientId(saved.clientId);
        setSecret(saved.secret);
      }
    });
  }, []);

  const saveKeys = async () => {
    setIgdbStatus('Conectando con Twitch…');
    try {
      await saveCredentials(clientId, secret);
      await testConnection();
      setIgdbStatus('Conectado: ya tienes portadas y puedes buscar cualquier juego.');
    } catch (error) {
      setIgdbStatus(error instanceof Error ? error.message : 'No se pudo conectar');
    }
  };

  // Supabase
  const [url, setUrl] = useState(cloudUrl);
  const [anonKey, setAnonKey] = useState(cloudAnonKey);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cloudStatus, setCloudStatus] = useState('');
  const configured = cloudConfig() !== null;
  const linkedHere = !!cloudUserId && cloudProfileId === currentProfileId;

  const run = async (label: string, task: () => Promise<unknown>, done: string) => {
    setCloudStatus(label);
    try {
      await task();
      setCloudStatus(done);
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : 'Algo ha fallado');
    }
  };

  // Copia de seguridad
  const [backup, setBackup] = useState('');
  const exportData = () => {
    const s = useStore.getState();
    const data = {
      app: 'saga-quest',
      version: 2,
      profiles: s.profiles,
      games: s.games,
      userGames: s.userGames,
      lists: s.lists,
      items: s.items,
      follows: s.follows,
    };
    Share.share({ title: 'Copia de Saga Quest', message: JSON.stringify(data) });
  };
  const importData = () => {
    try {
      const data = JSON.parse(backup);
      if (data.app !== 'saga-quest') throw new Error('No es una copia de Saga Quest');
      Alert.alert('Importar copia', 'Se sustituirán todos los datos de este móvil.', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar',
          style: 'destructive',
          onPress: () => {
            importSnapshot({
              profiles: data.profiles ?? {},
              games: data.games ?? {},
              userGames: data.userGames ?? {},
              lists: data.lists ?? {},
              items: data.items ?? {},
              follows: data.follows ?? {},
              currentProfileId: Object.keys(data.profiles ?? {})[0] ?? null,
            });
            setBackup('');
            router.dismissAll();
          },
        },
      ]);
    } catch (error) {
      Alert.alert('No se pudo leer', error instanceof Error ? error.message : 'Formato no válido');
    }
  };

  const confirmReset = () =>
    Alert.alert('Borrar todo', 'Se eliminarán todas las cuentas, listas, notas y reseñas de este móvil.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          resetAll();
          router.dismissAll();
          router.replace('/welcome');
        },
      },
    ]);

  return (
    <View style={styles.flex}>
      <ScreenHeader close title="Ajustes" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Section title="Estética">
          <SkinPicker />
        </Section>

        <Section title="Duración que se muestra">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'main', label: 'Historia' },
              { value: 'extra', label: '+ Secundarias' },
              { value: 'full', label: '100 %' },
            ]}
          />
        </Section>

        <Section title="IGDB · portadas y buscador">
          <ThemedText variant="muted" size={13}>
            Crea una aplicación gratis en dev.twitch.tv/console y pega aquí su Client ID y Client
            Secret. Se guardan cifrados en este móvil.
          </ThemedText>
          <TextField
            value={clientId}
            onChangeText={setClientId}
            placeholder="Client ID"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextField
            value={secret}
            onChangeText={setSecret}
            placeholder="Client Secret"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button label="Guardar y probar" onPress={saveKeys} />
          {igdbStatus ? <ThemedText variant="muted">{igdbStatus}</ThemedText> : null}
          <Button
            kind="ghost"
            label="Vaciar caché de imágenes"
            onPress={() => clearIgdbCache().then(() => setIgdbStatus('Caché vaciada'))}
          />
        </Section>

        <Section title="Nube · Supabase (opcional)">
          <ThemedText variant="muted" size={13}>
            Sin esto, todo se guarda solo en este móvil. Con un proyecto de Supabase (gratis), tus
            listas públicas las verá todo el mundo, tendrás cuenta con correo y podrás usarla en
            varios móviles. Crea el proyecto, ejecuta supabase/schema.sql y supabase/seed.sql del
            repositorio y pega aquí la URL y la clave «anon public».
          </ThemedText>
          <TextField
            value={url}
            onChangeText={setUrl}
            placeholder="https://xxxx.supabase.co"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TextField
            value={anonKey}
            onChangeText={setAnonKey}
            placeholder="Clave anon public"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            kind="ghost"
            label="Guardar proyecto"
            onPress={() => {
              setCloudConfig(url, anonKey);
              setCloudStatus(url && anonKey ? 'Proyecto guardado.' : 'Nube desactivada.');
            }}
          />

          {configured ? (
            <Panel>
              {linkedHere ? (
                <>
                  <ThemedText variant="bold">Sesión iniciada</ThemedText>
                  <ThemedText variant="muted" size={12}>
                    {lastSync
                      ? `Última sincronización: ${new Date(lastSync).toLocaleString('es-ES')}`
                      : 'Aún sin sincronizar'}
                    . Los cambios se suben solos cada pocos segundos.
                  </ThemedText>
                  <Button
                    label="Subir mis datos ahora"
                    onPress={() => run('Subiendo…', pushAll, 'Datos subidos.')}
                  />
                  <Button
                    kind="ghost"
                    label="Bajar mis datos de la nube"
                    onPress={() => run('Descargando…', pullAll, 'Datos descargados.')}
                  />
                  <Button
                    kind="ghost"
                    label="Actualizar listas de la comunidad"
                    onPress={() => run('Buscando listas…', fetchCommunity, 'Listas actualizadas.')}
                  />
                  <Button
                    kind="ghost"
                    label="Cerrar sesión en la nube"
                    onPress={() => run('Cerrando…', signOutCloud, 'Sesión cerrada.')}
                  />
                </>
              ) : (
                <>
                  <ThemedText variant="bold">Cuenta en la nube para este perfil</ThemedText>
                  <TextField
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Correo"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <TextField
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Contraseña (mín. 6)"
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <Button
                    label="Iniciar sesión"
                    onPress={() =>
                      run(
                        'Entrando…',
                        async () => {
                          await signIn(email.trim(), password);
                          await pullAll();
                          await fetchCommunity();
                        },
                        'Sesión iniciada y datos descargados.',
                      )
                    }
                  />
                  <Button
                    kind="ghost"
                    label="Crear cuenta y subir mis datos"
                    onPress={() =>
                      run(
                        'Creando cuenta…',
                        async () => {
                          await signUp(email.trim(), password);
                          await pushAll();
                        },
                        'Cuenta creada y datos subidos.',
                      )
                    }
                  />
                </>
              )}
            </Panel>
          ) : null}
          {cloudStatus ? <ThemedText variant="muted">{cloudStatus}</ThemedText> : null}
        </Section>

        <Section title="Copia de seguridad">
          <Button kind="ghost" label="Exportar todos mis datos" onPress={exportData} />
          <TextField
            value={backup}
            onChangeText={setBackup}
            placeholder="Pega aquí una copia exportada para restaurarla"
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
          {backup ? <Button label="Importar copia" onPress={importData} /> : null}
        </Section>

        <Section title="Peligro">
          <Button kind="ghost" label="Borrar todos los datos del móvil" onPress={confirmReset} />
        </Section>

        <ThemedText variant="muted" size={11} style={styles.version}>
          Saga Quest 2.0 · datos de duración aproximados (HowLongToBeat) · imágenes de IGDB
        </ThemedText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 26 },
  version: { textAlign: 'center' },
});
