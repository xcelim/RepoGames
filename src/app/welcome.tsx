import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Section } from '@/components/Section';
import { SkinPicker } from '@/components/SkinPicker';
import { ThemedText } from '@/components/ThemedText';
import { Panel, TextField } from '@/components/ui';
import { slugify } from '@/utils/text';
import { useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';
import { cloudConfig, isCloudEnabled } from '@/cloud/supabase';
import { useOnline } from '@/cloud/net';
import { confirmPasswordReset, resetPassword, signIn, signInWithGoogle, signUp } from '@/cloud/sync';
import { CloudAccountPanel } from '@/components/cloudPanel';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Segmented } from '@/components/Segmented';

WebBrowser.maybeCompleteAuthSession();

// Siempre hace falta una cuenta: con ella tu progreso se guarda en la base de datos
// y lo ves en cualquier dispositivo.
export default function WelcomeScreen() {
  return isCloudEnabled() ? <CloudWelcome /> : <NotConfigured />;
}

function NotConfigured() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
    >
      <ThemedText variant="display" size={40}>
        Saga Quest
      </ThemedText>
      <CloudAccountPanel />
    </ScrollView>
  );
}

// Con Supabase: entrar o crear una cuenta. Todo se guarda en la base de datos.
function CloudWelcome() {
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const localProfile = useStore((s) => (s.currentProfileId ? s.profiles[s.currentProfileId] : undefined));
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(localProfile?.displayName ?? '');
  const [username, setUsername] = useState(localProfile?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Algo ha fallado', error: true });
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(async () => {
      if (!email.trim() || password.length < 6)
        throw new Error('Escribe tu correo y una contraseña de 6 caracteres o más.');
      if (mode === 'login') {
        await signIn(email, password);
        router.replace('/');
        return;
      }
      if (!name.trim()) throw new Error('Pon tu nombre.');
      const result = await signUp({
        email,
        password,
        displayName: name,
        username: slugify(username || name) || 'jugador',
      });
      if (result === 'confirm') {
        setMode('login');
        setMessage({ text: 'Cuenta creada. Te hemos enviado un correo: confírmalo y después entra aquí.' });
        return;
      }
      router.replace('/');
    });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText variant="muted" size={12}>
          {'// TU REGISTRO DE PARTIDAS'}
        </ThemedText>
        <ThemedText variant="display" size={46}>
          Saga
          <ThemedText variant="display" size={46} style={{ color: skin.colors.accent }}>
            {'//'}
          </ThemedText>
          Quest
        </ThemedText>
        <ThemedText variant="muted">
          Para usar la app necesitas una cuenta. Tus listas, tu biblioteca y tus reseñas se guardan en ella y verás tu
          progreso en cualquier dispositivo.
        </ThemedText>

        {!online ? (
          <Panel>
            <ThemedText variant="bold">Sin conexión</ThemedText>
            <ThemedText variant="muted" size={13}>
              Para entrar o crear tu cuenta necesitas internet. Cuando ya hayas entrado podrás usar la app sin conexión
              si descargas tu perfil.
            </ThemedText>
          </Panel>
        ) : null}

        {localProfile ? (
          <Panel>
            <ThemedText variant="bold">Tienes datos en este móvil</ThemedText>
            <ThemedText variant="muted" size={13}>
              Las listas y la biblioteca de «{localProfile.displayName}» se subirán a la cuenta con la que entres.
            </ThemedText>
          </Panel>
        ) : null}

        <Pressable
          disabled={busy || !online}
          onPress={() =>
            run(async () => {
              const r = await signInWithGoogle();
              if (r === 'ok') router.replace('/');
            })
          }
          style={({ pressed }) => [styles.google, { opacity: !online ? 0.5 : pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="logo-google" size={20} color="#1f1f1f" />
          <ThemedText variant="bold" size={16} style={{ color: '#1f1f1f' }}>
            Continuar con Google
          </ThemedText>
        </Pressable>
        <ThemedText variant="muted" size={12} style={{ textAlign: 'center' }}>
          o con tu correo
        </ThemedText>

        <Panel>
          <Segmented
            value={mode}
            onChange={(m) => {
              setMode(m);
              setMessage(null);
            }}
            options={[
              { value: 'login', label: 'Entrar' },
              { value: 'signup', label: 'Crear cuenta' },
            ]}
          />
          {mode === 'signup' ? (
            <>
              <TextField
                label="Nombre"
                value={name}
                onChangeText={setName}
                placeholder="Cómo quieres que te vean"
                maxLength={40}
              />
              <TextField
                label="Usuario"
                value={username}
                onChangeText={setUsername}
                placeholder={slugify(name) || 'tu-usuario'}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={24}
              />
            </>
          ) : null}
          <TextField
            label="Correo"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextField
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 6 caracteres"
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'login' ? 'password' : 'new-password'}
          />
          {busy ? (
            <ActivityIndicator color={skin.colors.accent} />
          ) : (
            <Button label={mode === 'login' ? 'Entrar' : 'Crear cuenta'} onPress={submit} />
          )}
          {mode === 'login' ? (
            <ThemedText
              variant="muted"
              size={12}
              style={{ textDecorationLine: 'underline', textAlign: 'center' }}
              onPress={() =>
                run(async () => {
                  if (!email.trim()) throw new Error('Escribe tu correo arriba y vuelve a pulsar.');
                  await resetPassword(email);
                  setResetting(true);
                  setMessage({
                    text: 'Te hemos enviado un correo con un código. Escríbelo abajo con tu nueva contraseña.',
                  });
                })
              }
            >
              He olvidado mi contraseña
            </ThemedText>
          ) : null}
          {message ? <Note error={message.error}>{message.text}</Note> : null}
          {resetting && mode === 'login' ? (
            <>
              <TextField
                label="Código del correo"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={10}
              />
              <TextField
                label="Nueva contraseña"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <Button
                label="Cambiar contraseña y entrar"
                onPress={() =>
                  run(async () => {
                    if (newPassword.length < 6)
                      throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
                    await confirmPasswordReset(email, code, newPassword);
                    router.replace('/');
                  })
                }
              />
            </>
          ) : null}
        </Panel>

        <ThemedText variant="muted" size={11} style={{ textAlign: 'center' }}>
          Servidor: {cloudConfig()?.url}
        </ThemedText>

        <Section title="Elige tu estética">
          <SkinPicker />
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Note({ children, error }: { children: ReactNode; error?: boolean }) {
  return (
    <ThemedText size={13} style={{ color: error ? '#e5484d' : undefined }}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 22 },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#dadce0',
  },
});
