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
