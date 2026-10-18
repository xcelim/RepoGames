import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { useStore } from '@/store/useStore';

// La URL y la clave pública (anon) del proyecto pueden venir de Ajustes o de un .env:
//   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
//   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
// La clave anon es pública por diseño: la seguridad la ponen las políticas RLS de supabase/schema.sql.
export function cloudConfig(): { url: string; anonKey: string } | null {
  const state = useStore.getState();
  const url = state.cloudUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const anonKey = state.cloudAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  return url && anonKey ? { url, anonKey } : null;
}

let client: SupabaseClient | null = null;
let clientKey = '';

export function getSupabase(): SupabaseClient | null {
  const config = cloudConfig();
  if (!config) return null;
  const key = `${config.url}|${config.anonKey}`;
  if (!client || key !== clientKey) {
    client = createClient(config.url, config.anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        // Inicio de sesión con Google: el navegador devuelve un código que la app canjea.
        flowType: 'pkce',
      },
    });
    clientKey = key;
  }
  return client;
}

export function isCloudEnabled(): boolean {
  return cloudConfig() !== null;
}
