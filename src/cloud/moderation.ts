// Bloquear y denunciar usuarios. La base de datos se encarga de lo importante (un bloqueado no
// puede pedirte amistad ni escribirte, y la amistad se deshace); aquí se esconde lo que quede.
import { create } from 'zustand';

import { useStore } from '@/store/useStore';

import { isMissingError } from './conversations';
import { refreshSocial } from './social';
import { getSupabase } from './supabase';

type State = { blocked: string[]; loaded: boolean; missing: boolean };
export const useBlocks = create<State>()(() => ({ blocked: [], loaded: false, missing: false }));

export const REPORT_REASONS = [
  'Spam o publicidad',
  'Contenido ofensivo o de odio',
  'Acoso o amenazas',
  'Suplantación de identidad',
  'Contenido sexual o violento',
  'Otro motivo',
];

export async function loadBlocks(): Promise<void> {
  const client = getSupabase();
  const uid = useStore.getState().cloudUserId;
  if (!client || !uid) return;
  const { data, error } = await client.from('user_blocks').select('blocked').eq('blocker', uid);
  if (isMissingError(error)) {
    useBlocks.setState({ loaded: true, missing: true });
    return;
  }
  if (error) return;
  useBlocks.setState({
    blocked: ((data as { blocked: string }[]) ?? []).map((r) => r.blocked),
    loaded: true,
    missing: false,
  });
}

export async function blockUser(id: string): Promise<void> {
  const client = getSupabase();
  const uid = useStore.getState().cloudUserId;
  if (!client || !uid) throw new Error('Necesitas conexión');
  const { error } = await client.from('user_blocks').upsert({ blocker: uid, blocked: id }, { ignoreDuplicates: true });
  if (error) throw new Error(isMissingError(error) ? 'Falta ejecutar el SQL de seguridad en Supabase' : error.message);
  useBlocks.setState((s) => ({ blocked: [...new Set([...s.blocked, id])] }));
  refreshSocial().catch(() => undefined);
}

export async function unblockUser(id: string): Promise<void> {
  const client = getSupabase();
  const uid = useStore.getState().cloudUserId;
  if (!client || !uid) throw new Error('Necesitas conexión');
  const { error } = await client.from('user_blocks').delete().eq('blocker', uid).eq('blocked', id);
  if (error) throw new Error(error.message);
  useBlocks.setState((s) => ({ blocked: s.blocked.filter((b) => b !== id) }));
}

export async function reportUser(input: {
  target: string;
  kind?: 'user' | 'review' | 'list' | 'message' | 'game' | 'other';
  targetId?: string;
  reason: string;
}): Promise<void> {
  const client = getSupabase();
  const uid = useStore.getState().cloudUserId;
  if (!client || !uid) throw new Error('Necesitas conexión');
  const { error } = await client.from('reports').insert({
    reporter: uid,
    target_profile: input.target,
    kind: input.kind ?? 'user',
    target_id: input.targetId ?? null,
    reason: input.reason.slice(0, 1000),
  });
  if (error) throw new Error(isMissingError(error) ? 'Falta ejecutar el SQL de seguridad en Supabase' : error.message);
}

export type Report = {
  id: string;
  reporter: string;
  target: string | null;
  kind: string;
  targetId: string | null;
  reason: string;
  status: 'open' | 'done' | 'dismissed';
  createdAt: string;
};

// Para administradores: las denuncias abiertas.
export async function loadReports(): Promise<Report[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from('reports').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (
    (data as {
      id: string;
      reporter: string;
      target_profile: string | null;
      kind: string;
      target_id: string | null;
      reason: string;
      status: Report['status'];
      created_at: string;
    }[]) ?? []
  ).map((r) => ({
    id: r.id,
    reporter: r.reporter,
    target: r.target_profile,
    kind: r.kind,
    targetId: r.target_id,
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function setReportStatus(id: string, status: Report['status']): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.from('reports').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

// Versión mínima obligatoria (solo administradores).
export async function setMinBuild(build: number, message: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Necesitas conexión');
  const { error } = await client
    .from('app_config')
    .upsert({ key: 'min_build', value: { build, message }, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function getMinBuild(): Promise<{ build: number; message: string }> {
  const client = getSupabase();
  if (!client) return { build: 0, message: '' };
  const { data } = await client.from('app_config').select('value').eq('key', 'min_build').maybeSingle();
  const v = ((data as { value?: { build?: number; message?: string } } | null)?.value ?? {}) as {
    build?: number;
    message?: string;
  };
  return { build: Number(v.build ?? 0), message: v.message ?? '' };
}
