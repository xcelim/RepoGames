// Avisos de versión nueva: la APK sabe qué compilación es (EXPO_PUBLIC_BUILD, la pone GitHub Actions)
// y mira la última versión publicada en GitHub. Si hay una más nueva, ofrece descargarla.
import { Platform } from 'react-native';

export const BUILD = Number(process.env.EXPO_PUBLIC_BUILD ?? 0) || 0;
const RELEASES = 'https://api.github.com/repos/xcelim/RepoGames/releases/latest';

export type AppUpdate = { build: number; tag: string; url: string };

export const canSelfUpdate = Platform.OS === 'android' && BUILD > 0;

export async function checkForUpdate(): Promise<AppUpdate | null> {
  if (!canSelfUpdate) return null;
  try {
    const res = await fetch(RELEASES, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      tag_name?: string;
      html_url?: string;
      assets?: { name: string; browser_download_url: string }[];
    };
    const build = Number(data.tag_name?.match(/(\d+)$/)?.[1] ?? 0);
    if (!build || build <= BUILD) return null;
    const apk = data.assets?.find((a) => a.name.endsWith('.apk'));
    return { build, tag: data.tag_name ?? '', url: apk?.browser_download_url ?? data.html_url ?? '' };
  } catch {
    return null;
  }
}

// Versión mínima obligatoria (tabla app_config de Supabase): si esta APK es más vieja, hay que actualizar.
export type Required = { build: number; message: string };

export async function requiredUpdate(): Promise<Required | null> {
  if (!canSelfUpdate) return null;
  try {
    const { getSupabase } = await import('@/cloud/supabase');
    const client = getSupabase();
    if (!client) return null;
    const { data, error } = await client.from('app_config').select('value').eq('key', 'min_build').maybeSingle();
    if (error || !data) return null;
    const v = (data as { value: { build?: number; message?: string } }).value ?? {};
    const min = Number(v.build ?? 0);
    return min > BUILD ? { build: min, message: v.message ?? '' } : null;
  } catch {
    return null;
  }
}
