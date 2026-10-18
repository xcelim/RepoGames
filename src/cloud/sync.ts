// Cuentas (Supabase Auth) y listas públicas de la comunidad.
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { useStore } from '@/store/useStore';
import type { Profile } from '@/types';

import { flush, markAllDirty, syncNow, useSync } from './engine';
import {
  fromGameRow,
  fromItemRow,
  fromListRow,
  fromProfileRow,
  type GameRow,
  type ListItemRow,
  type ListRow,
  type ProfileRow,
} from './mappers';
import { useConnection } from './net';
import { useRemote } from './remote';
import { getSupabase } from './supabase';

function requireClient() {
  const client = getSupabase();
  if (!client) throw new Error('Esta versión de la app no tiene configurado Supabase.');
  return client;
}

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// Mensajes de Supabase en español.
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(message)) return 'Confirma primero tu correo (revisa tu bandeja de entrada).';
  if (/already registered|already been registered/i.test(message)) return 'Ya hay una cuenta con ese correo. Entra con él.';
  if (/password should be at least/i.test(message)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/unable to validate email|invalid email/i.test(message)) return 'Ese correo no es válido.';
  if (/network request failed|failed to fetch/i.test(message)) return 'Sin conexión. Inténtalo cuando tengas internet.';
  return message;
}

// Tras entrar: el perfil de la nube pasa a ser el de la app (y lo que hubiera en el móvil se sube).
async function afterLogin(uid: string, email: string | null): Promise<void> {
  const client = requireClient();
  const row = check(await client.from('profiles').select('*').eq('id', uid).maybeSingle()) as ProfileRow | null;
  const state = useStore.getState();
  const local = state.currentProfileId ? state.profiles[state.currentProfileId] : undefined;
  const hadLocalData = !!local && !state.cloudUserId;
  const profile: Profile = row
    ? fromProfileRow(row)
    : {
        id: uid,
        username: local?.username ?? (email ?? 'jugador').split('@')[0],
        displayName: local?.displayName ?? (email ?? 'Jugador').split('@')[0],
        bio: '',
        avatarColor: local?.avatarColor ?? '#7b2ff7',
        createdAt: new Date().toISOString(),
      };
  // Si en el móvil ya tenías un perfil (de antes de la nube), sus datos se suben a tu cuenta.
  useStore.getState().adoptAccount(uid, email, hadLocalData ? { ...profile, avatarColor: local!.avatarColor } : profile);
  if (hadLocalData || !row) markAllDirty(uid);
  // Cuenta recién creada: se guarda también la estética elegida en la bienvenida.
  else if (!row.settings?.skin) useStore.setState({ dirty: { ...useStore.getState().dirty, [`profiles|${uid}`]: Date.now() } });
  useSync.setState({ ready: false });
  await syncNow();
}

export async function signUp(data: { email: string; password: string; displayName: string; username: string }): Promise<'ok' | 'confirm'> {
  const client = requireClient();
  const { data: result, error } = await client.auth.signUp({
    email: data.email.trim(),
    password: data.password,
    options: { data: { username: data.username.trim().toLowerCase(), display_name: data.displayName.trim() } },
  });
  if (error) throw new Error(friendly(error.message));
  if (!result.user) throw new Error('No se pudo crear la cuenta.');
  // Si el proyecto pide confirmar el correo, aún no hay sesión.
  if (!result.session) return 'confirm';
  await afterLogin(result.user.id, result.user.email ?? data.email);
  // El usuario ya lo ha elegido en el formulario de registro.
  const current = useStore.getState().profiles[result.user.id];
  if (current) {
    useStore.getState().updateProfile({
      displayName: data.displayName.trim() || current.displayName,
      onboarded: true,
    });
  }
  return 'ok';
}

export async function signIn(email: string, password: string): Promise<void> {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) throw new Error(friendly(error?.message ?? 'No se pudo iniciar sesión'));
  await afterLogin(data.user.id, data.user.email ?? email);
}

// Contraseña olvidada: Supabase manda un correo con un código de 6 cifras ({{ .Token }}
// en la plantilla "Reset Password"); con ese código se pone la nueva sin salir de la app.
// ---------- Google ----------

export const OAUTH_REDIRECT = 'auth-callback';

// Abre la página de Google (a través de Supabase) y vuelve a la app con un código.
export async function signInWithGoogle(): Promise<'ok' | 'cancel'> {
  const client = requireClient();
  const redirectTo = Linking.createURL(OAUTH_REDIRECT);
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error || !data.url) throw new Error(friendly(error?.message ?? 'No se pudo abrir Google'));
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return 'cancel';
  await completeOAuth(result.url);
  return 'ok';
}

let exchanging: Promise<void> | null = null;

// Canjea el código que devuelve Google por una sesión (también si la app se abre con el enlace).
export function completeOAuth(url: string): Promise<void> {
  if (exchanging) return exchanging;
  exchanging = (async () => {
    const client = requireClient();
    const parsed = new URL(url.replace('#', url.includes('?') ? '&' : '?'));
    const failure = parsed.searchParams.get('error_description') ?? parsed.searchParams.get('error');
    if (failure) throw new Error(friendly(failure));
    const code = parsed.searchParams.get('code');
    if (!code) {
      const { data } = await client.auth.getSession();
      if (data.session) return afterLogin(data.session.user.id, data.session.user.email ?? null);
      throw new Error('Google no devolvió ningún código. Inténtalo otra vez.');
    }
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.user) throw new Error(friendly(error?.message ?? 'No se pudo entrar con Google'));
    await afterLogin(data.user.id, data.user.email ?? null);
  })().finally(() => {
    exchanging = null;
  });
  return exchanging;
}

// ---------- Crear tu usuario (la primera vez) ----------

export async function isUsernameFree(username: string): Promise<boolean> {
  const client = requireClient();
  const uid = useStore.getState().cloudUserId;
  let q = client.from('profiles').select('id').eq('username', username);
  if (uid) q = q.neq('id', uid);
  const { data, error } = await q.limit(1);
  if (error) throw new Error(error.message);
  return !(data ?? []).length;
}

export async function finishOnboarding(data: { displayName: string; username: string; avatarColor: string }): Promise<void> {
  const username = data.username.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,30}$/.test(username)) {
    throw new Error('El usuario debe tener entre 3 y 30 letras minúsculas, números o guiones.');
  }
  if (!(await isUsernameFree(username))) throw new Error(`@${username} ya está cogido. Prueba con otro.`);
  useStore.getState().updateProfile({
    displayName: data.displayName.trim(),
    username,
    avatarColor: data.avatarColor,
    onboarded: true,
  });
  await flush();
}

export async function resetPassword(email: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.auth.resetPasswordForEmail(email.trim());
  if (error) throw new Error(friendly(error.message));
}

export async function confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
  const client = requireClient();
  const { data, error } = await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
  if (error || !data.user) throw new Error(friendly(error?.message ?? 'Código incorrecto o caducado'));
  const update = await client.auth.updateUser({ password: newPassword });
  if (update.error) throw new Error(friendly(update.error.message));
  await afterLogin(data.user.id, data.user.email ?? email);
}

// Cerrar sesión: se sube lo pendiente y se borran del móvil los datos de la cuenta.
export async function signOutCloud(force = false): Promise<void> {
  const pending = Object.keys(useStore.getState().dirty).length;
  if (pending && useConnection.getState().online) await flush().catch(() => undefined);
  if (!force && Object.keys(useStore.getState().dirty).length) {
    throw new Error(`Tienes ${Object.keys(useStore.getState().dirty).length} cambios sin subir. Conéctate a internet antes de cerrar sesión.`);
  }
  const client = getSupabase();
  if (client) await client.auth.signOut().catch(() => undefined);
  useStore.getState().clearLocalData();
  useSync.setState({ ready: false, status: 'idle', error: null });
}

export async function deleteAccount(): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('delete_my_account');
  if (error) throw new Error(error.message);
  await client.auth.signOut().catch(() => undefined);
  useStore.getState().clearLocalData();
}

// Al abrir la app: si Supabase recuerda la sesión, se mantiene (también sin conexión).
export async function restoreSession(): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const { data } = await client.auth.getSession();
  const user = data.session?.user;
  const state = useStore.getState();
  if (user && !state.cloudUserId) await afterLogin(user.id, user.email ?? null).catch(() => undefined);
  // La sesión caducó en el servidor y no hay forma de renovarla: hay que volver a entrar.
  if (!user && state.cloudUserId && useConnection.getState().online) {
    const pending = Object.keys(state.dirty).length;
    if (!pending) state.clearLocalData();
  }
}

// ---------- Listas públicas de toda la comunidad ----------

export async function fetchCommunity(): Promise<void> {
  const client = getSupabase();
  if (!client || !useConnection.getState().online) return;
  const remote = useRemote.getState();
  remote.setData({ loading: true, error: null });
  try {
    const uid = useStore.getState().cloudUserId;
    let query = client
      .from('lists')
      .select('*')
      .eq('visibility', 'public')
      .eq('official', false)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (uid) query = query.neq('owner_id', uid);
    const listRows = check(await query) as ListRow[];
    const listIds = listRows.map((l) => l.id);
    const ownerIds = [...new Set(listRows.map((l) => l.owner_id).filter((id): id is string => !!id))];
    const itemRows = listIds.length
      ? (check(await client.from('list_items').select('*').in('list_id', listIds)) as ListItemRow[])
      : [];
    const profileRows = ownerIds.length
      ? (check(await client.from('profiles').select('*').in('id', ownerIds)) as ProfileRow[])
      : [];
    const gameIds = [...new Set(itemRows.map((i) => i.game_id))];
    const gameRows = gameIds.length
      ? (check(await client.from('games').select('*').in('id', gameIds.slice(0, 1000))) as GameRow[])
      : [];

    remote.setData({
      lists: Object.fromEntries(listRows.map((r) => [r.id, fromListRow(r)])),
      items: Object.fromEntries(itemRows.map((r) => [r.id, fromItemRow(r)])),
      profiles: Object.fromEntries(profileRows.map((r) => [r.id, fromProfileRow(r)])),
      games: Object.fromEntries(gameRows.map((r) => [r.id, fromGameRow(r)])),
      loading: false,
    });
  } catch (error) {
    remote.setData({ loading: false, error: error instanceof Error ? error.message : 'Error' });
  }
}
