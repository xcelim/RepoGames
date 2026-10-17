import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSkin } from '@/theme/useSkin';
import type { GameList } from '@/types';

import { ThemedText } from './ThemedText';
import { IconButton, type IconName } from './ui';

// ---------- Tarjeta de lista con forma de carpeta ----------
type ListCardProps = {
  list: GameList;
  count: number;
  owner?: string;
  progress?: number; // 0-1
  width?: number;
  subtitle?: string;
};

export function ListCard({ list, count, owner, progress, width, subtitle }: ListCardProps) {
  const skin = useSkin();
  const radius = Math.min(skin.radius, 18);
  return (
    <Pressable
      onPress={() => router.push(`/list/${list.id}`)}
      style={({ pressed }) => [
        { width: width ?? '100%', transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      {/* Pestaña de la carpeta */}
      <View
        style={[
          styles.tab,
          { backgroundColor: list.color, borderTopLeftRadius: radius, borderTopRightRadius: radius },
        ]}
      />
      <View
        style={[
          styles.folder,
          {
            borderRadius: radius,
            borderTopLeftRadius: 0,
            backgroundColor: skin.colors.panel,
            borderColor: skin.colors.line,
            borderWidth: skin.borderWidth,
          },
        ]}
      >
        <View style={[styles.art, { borderTopRightRadius: radius }]}>
          <LinearGradient
            colors={[list.color, list.color2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons
            name={list.icon as IconName}
            size={84}
            color="rgba(255,255,255,0.22)"
            style={styles.bigIcon}
          />
          <View style={styles.badges}>
            <Ionicons
              name={list.visibility === 'public' ? 'globe-outline' : 'lock-closed'}
              size={14}
              color="#ffffff"
            />
            {list.official ? <Ionicons name="checkmark-circle" size={14} color="#ffffff" /> : null}
          </View>
          <ThemedText
            variant="display"
            size={22}
            numberOfLines={2}
            style={styles.name}
          >
            {list.name}
          </ThemedText>
        </View>
        <View style={styles.meta}>
          <ThemedText variant="muted" size={12} numberOfLines={1}>
            {subtitle ?? `${count} juegos${owner ? ` · ${owner}` : ''}`}
          </ThemedText>
          {progress !== undefined ? (
            <View style={[styles.track, { backgroundColor: skin.colors.panel2 }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.round(progress * 100)}%`, backgroundColor: skin.colors.accent },
                ]}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// ---------- Cabecera de pantalla ----------
type ScreenHeaderProps = {
  title?: string;
  back?: boolean;
  close?: boolean;
  right?: ReactNode;
};

export function ScreenHeader({ title, back, close, right }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      {back || close ? (
        <IconButton
          icon={close ? 'close' : 'chevron-back'}
          label={close ? 'Cerrar' : 'Volver'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      ) : null}
      <ThemedText variant="display" size={20} numberOfLines={1} style={styles.headerTitle}>
        {title ?? ''}
      </ThemedText>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

// ---------- Título de sección con acción ----------
export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const skin = useSkin();
  return (
    <View style={styles.sectionTitle}>
      <ThemedText variant="display" size={20} style={styles.flex}>
        {title}
      </ThemedText>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <ThemedText variant="bold" size={13} style={{ color: skin.colors.accent }}>
            {action}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { width: '42%', height: 10 },
  folder: { overflow: 'hidden' },
  art: { height: 110, overflow: 'hidden', justifyContent: 'flex-end', padding: 12 },
  bigIcon: { position: 'absolute', right: -8, top: -6 },
  badges: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 6 },
  name: { color: '#ffffff' },
  meta: { padding: 10, gap: 6 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  headerTitle: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
