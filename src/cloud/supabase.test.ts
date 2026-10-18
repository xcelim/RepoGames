import { normalizeUrl } from './supabase';
jest.mock('@/store/useStore', () => ({ useStore: { getState: () => ({ cloudUrl: '', cloudAnonKey: '' }) } }));

describe('URL de Supabase', () => {
  it('se queda solo con el proyecto', () => {
    expect(normalizeUrl('https://abc.supabase.co/rest/v1/')).toBe('https://abc.supabase.co');
    expect(normalizeUrl(' "https://abc.supabase.co/" ')).toBe('https://abc.supabase.co');
    expect(normalizeUrl('abc.supabase.co')).toBe('https://abc.supabase.co');
    expect(normalizeUrl('https://ABC.supabase.co/auth/v1/callback')).toBe('https://abc.supabase.co');
    expect(normalizeUrl('')).toBe('');
  });
});
