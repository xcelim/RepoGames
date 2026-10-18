// Cuentas (Supabase Auth) y listas públicas de la comunidad.
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
