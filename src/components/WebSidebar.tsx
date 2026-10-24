// Barra lateral de la web en el PC: las mismas secciones que las pestañas de la app.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { refreshEverything } from '@/cloud/refresh';

import { usePendingRequests, useUnreadCount } from '@/cloud/social';
import { useUnreadNotifications } from '@/hooks/useNotifications';
import { useCurrentProfile, useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';
import { setPageBackground, SIDEBAR_W, useDesktop } from '@/web/frame';

import { ThemedText } from './ThemedText';
import type { IconName } from './ui';
import { UserAvatar } from './UserAvatar';

type Item = { href: Href; label: string; icon: IconName; iconActive: IconName; match: (p: string) => boolean };

const MAIN: Item[] = [
  {
    href: '/',
    label: 'Descubrir',
    icon: 'tv-outline',
    iconActive: 'tv',
    match: (p) => p === '/' || p.startsWith('/discover'),
  },
  {
    href: '/library',
    label: 'Biblioteca',
    icon: 'library-outline',
    iconActive: 'library',
    match: (p) => p.startsWith('/library'),
  },
  {
    href: '/lists',
    label: 'Listas',
    icon: 'albums-outline',
    iconActive: 'albums',
    match: (p) => p.startsWith('/list'),
  },
  {
    href: '/social',
    label: 'Amigos',
    icon: 'people-outline',
    iconActive: 'people',
    match: (p) =>
      ['/social', '/friends', '/chat', '/group', '/user', '/challenge', '/leaderboard'].some((x) => p.startsWith(x)),
  },
  {
    href: '/profile',
    label: 'Perfil',
    icon: 'person-circle-outline',
    iconActive: 'person-circle',
    match: (p) => p.startsWith('/profile') || p.startsWith('/level') || p.startsWith('/platinum'),
  },
];

const EXTRA: Item[] = [
  {
    href: '/arcade',
    label: 'Sala de juegos',
    icon: 'sparkles-outline',
    iconActive: 'sparkles',
    match: (p) =>
      [
        '/arcade',
        '/oracle',
        '/versus',
        '/tierlist',
        '/shelf',
        '/stats',
        '/timeline',
        '/releases',
        '/roulette',
        '/wrapped',
      ].some((x) => p.startsWith(x)),
  },
  {
    href: '/search',
    label: 'Buscar juegos',
    icon: 'search-outline',
    iconActive: 'search',
    match: (p) => p.startsWith('/search'),
  },
  {
    href: '/notifications',
    label: 'Avisos',
    icon: 'notifications-outline',
    iconActive: 'notifications',
    match: (p) => p.startsWith('/notifications'),
  },
  {
    href: '/settings',
    label: 'Ajustes',
    icon: 'settings-outline',
    iconActive: 'settings',
    match: (p) => p.startsWith('/settings'),
  },
];

const HIDDEN = ['/welcome', '/onboarding', '/auth-callback'];

export function WebSidebar() {
  const desktop = useDesktop();
  const skin = useSkin();
  const path = usePathname();
  const profile = useCurrentProfile();
  const uid = useStore((s) => s.cloudUserId);
  const social = useUnreadCount() + usePendingRequests();
  const notes = useUnreadNotifications();
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => setPageBackground(skin.colors.bg), [skin.colors.bg]);
  if (!desktop || !uid || !profile?.onboarded || HIDDEN.some((h) => path.startsWith(h))) return null;

  const row = (it: Item, badge = 0) => {
    const on = it.match(path);
    const color = on ? skin.colors.text : skin.colors.muted;
    return (
      <Pressable
        key={it.label}
        onPress={() => router.navigate(it.href)}
        style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
          styles.item,
          {
            borderRadius: Math.min(skin.radius, 14),
            backgroundColor: on ? skin.colors.panel2 : hovered || pressed ? `${skin.colors.panel2}99` : 'transparent',
          },
        ]}
      >
        <Ionicons name={on ? it.iconActive : it.icon} size={22} color={color} />
        <ThemedText variant={on ? 'bold' : 'body'} size={15} style={{ color, flex: 1 }}>
          {it.label}
        </ThemedText>
        {badge ? (
          <View style={styles.badge}>
            <ThemedText variant="bold" size={11} style={{ color: '#fff' }}>
              {badge > 99 ? '99+' : badge}
            </ThemedText>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        { position: 'fixed' } as unknown as ViewStyle,
        { width: SIDEBAR_W, backgroundColor: skin.colors.panel, borderRightColor: skin.colors.line },
      ]}
    >
      <Pressable onPress={() => router.navigate('/')} style={styles.logo}>
        <ThemedText variant="display" size={26}>
          Saga
          <ThemedText variant="display" size={26} style={{ color: skin.colors.accent }}>
            {'//'}
          </ThemedText>
          Quest
        </ThemedText>
      </Pressable>
      <View style={styles.group}>{MAIN.map((it) => row(it, it.href === '/social' ? social : 0))}</View>
      <View style={[styles.sep, { backgroundColor: skin.colors.line }]} />
      <View style={styles.group}>{EXTRA.map((it) => row(it, it.href === '/notifications' ? notes : 0))}</View>
      <Pressable
        onPress={() => {
          if (refreshing) return;
          setRefreshing(true);
          refreshEverything().finally(() => setRefreshing(false));
        }}
        style={({ hovered }: { hovered?: boolean }) => [
          styles.item,
          {
            borderRadius: Math.min(skin.radius, 14),
            backgroundColor: hovered ? `${skin.colors.panel2}99` : 'transparent',
          },
        ]}
      >
        {refreshing ? (
          <ActivityIndicator size="small" color={skin.colors.muted} style={{ width: 22 }} />
        ) : (
          <Ionicons name="refresh" size={22} color={skin.colors.muted} />
        )}
        <ThemedText size={15} style={{ color: skin.colors.muted, flex: 1 }}>
          {refreshing ? 'Actualizando…' : 'Actualizar'}
        </ThemedText>
      </Pressable>
      <View style={{ flex: 1 }} />
      <Pressable onPress={() => router.navigate('/profile')} style={[styles.me, { borderTopColor: skin.colors.line }]}>
        <UserAvatar profile={profile} size={38} />
        <View style={{ flex: 1 }}>
          <ThemedText variant="bold" size={14} numberOfLines={1}>
            {profile.displayName}
          </ThemedText>
          <ThemedText variant="muted" size={12} numberOfLines={1}>
            @{profile.username}
          </ThemedText>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { left: 0, top: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 22, borderRightWidth: 1, zIndex: 10 },
  logo: { paddingHorizontal: 10, paddingBottom: 22 },
  group: { gap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, paddingVertical: 11 },
  sep: { height: 1, marginVertical: 14, marginHorizontal: 8 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e5484d',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  me: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderTopWidth: 1 },
});
