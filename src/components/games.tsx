import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { OFFICIAL_SERIES } from '@/data/catalog';
import { LIST_COLORS, STATUS_META, STATUS_ORDER } from '@/data/meta';
import { rawgImage } from '@/api/rawg';
import { useCover } from '@/hooks/useIgdb';
import { DECOR, decorColor, type Frame } from '@/theme/decor';
import { useSkin } from '@/theme/useSkin';
import type { GameRecord, PlayStatus, UserGame } from '@/types';

import { ThemedText } from './ThemedText';
import type { IconName } from './ui';

// ---------- Colores de un juego (los de su saga o unos fijos según el título) ----------
export function gameColors(game: GameRecord): [string, string] {
  const saga = OFFICIAL_SERIES.find((s) => s.id === game.series);
  if (saga) return [saga.color, saga.color2];
  let hash = 0;
  for (const char of game.title) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return LIST_COLORS[Math.abs(hash) % LIST_COLORS.length];
}

// ---------- Carátula ----------
export function GameCover({
  game,
  width,
  url: forcedUrl,
  square,
  radius,
}: {
  game: GameRecord;
  width: number;
  url?: string | null;
  square?: boolean;
  radius?: number;
}) {
  const skin = useSkin();
  const cover = useCover(forcedUrl ? undefined : game);
  const url = forcedUrl ?? cover;
  const src = url && url.includes('media.rawg.io/media/games/') ? rawgImage(url, 640) : url;
  const [c1, c2] = gameColors(game);
  const height = square ? width : width * (4 / 3);
  const words = game.title.replace(/[^A-Za-z0-9 ]/g, ' ').split(' ').filter(Boolean);
  const important = words.filter((w) => /^[A-Z0-9]/.test(w));
  const initials = (important.length ? important : words)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  // Marco de la estética (solo en portadas grandes; las miniaturas van limpias).
  const decor = DECOR[skin.id];
  const frame: Frame | null = decor && width >= 100 ? decor.frame : null;
  const fc = decor ? decorColor(skin, decor.frameColor ?? 'accent') : skin.colors.accent;
  const baseRadius = radius ?? Math.min(skin.radius, 12);
  const r = frame === 'pixel' || frame === 'notch' ? 0 : frame === 'rounded' ? Math.max(baseRadius, 16) : baseRadius;

  const coverView = (
    <View
      style={[
        styles.cover,
        { width, height, borderRadius: r, backgroundColor: c1 },
        frame === 'glow' ? { borderWidth: 1.5, borderColor: fc } : null,
      ]}
    >
      <LinearGradient
        colors={[c1, c2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {!url ? (
        <ThemedText variant="display" size={width * 0.28} style={styles.initials}>
          {initials}
        </ThemedText>
      ) : null}
      {src ? (
        // La portada siempre entera (sin recortar); si no encaja, se ven los colores del juego a los lados.
        <Image
          source={src}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={120}
          cachePolicy="memory-disk"
          recyclingKey={game.id}
        />
      ) : null}
      {frame ? <FrameOverlay frame={frame} color={fc} bg={skin.colors.bg} radius={r} /> : null}
    </View>
  );

  if (frame === 'offset') {
    return (
      <View style={{ width, height }}>
        <View style={[styles.offset, { width, height, borderRadius: r, backgroundColor: fc }]} />
        {coverView}
      </View>
    );
  }
  if (frame === 'glow') {
    return <View style={[{ width, height, borderRadius: r, shadowColor: fc, shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 8, backgroundColor: c1 }]}>{coverView}</View>;
  }
  return coverView;
}

function Corner({ pos, color, size, thick, inset }: { pos: 'tl' | 'tr' | 'bl' | 'br'; color: string; size: number; thick: number; inset: number }) {
  const s: Record<string, number | string> = { position: 'absolute', width: size, height: size, borderColor: color };
  if (pos[0] === 't') Object.assign(s, { top: inset, borderTopWidth: thick });
  else Object.assign(s, { bottom: inset, borderBottomWidth: thick });
  if (pos[1] === 'l') Object.assign(s, { left: inset, borderLeftWidth: thick });
  else Object.assign(s, { right: inset, borderRightWidth: thick });
  return <View style={s} />;
}

function FrameOverlay({ frame, color, bg, radius }: { frame: Frame; color: string; bg: string; radius: number }) {
  switch (frame) {
    case 'thin':
      return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 1, borderColor: color + 'aa' }]} />;
    case 'double':
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 2.5, borderColor: color }]} />
          <View style={[styles.inset4, { borderRadius: Math.max(0, radius - 4), borderWidth: 1, borderColor: color + 'aa' }]} />
        </View>
      );
    case 'pixel':
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, { borderWidth: 3, borderColor: color }]} />
          <View style={[styles.inset3, { borderWidth: 2, borderColor: 'rgba(255,255,255,0.22)' }]} />
        </View>
      );
    case 'rounded':
      return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 2.5, borderColor: color + 'cc' }]} />;
    case 'corners':
    case 'hud': {
      const hud = frame === 'hud';
      const props = { color, size: hud ? 16 : 14, thick: hud ? 2.5 : 1.5, inset: hud ? 4 : 6 };
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {hud ? <View style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 1, borderColor: color + '55' }]} /> : null}
          <Corner pos="tl" {...props} />
          <Corner pos="tr" {...props} />
          <Corner pos="bl" {...props} />
          <Corner pos="br" {...props} />
        </View>
      );
    }
    case 'notch':
      // Esquinas cortadas en diagonal.
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, { borderWidth: 1, borderColor: color + '88' }]} />
          <View style={[styles.notchTL, { borderTopColor: bg }]} />
          <View style={[styles.notchBR, { borderBottomColor: bg }]} />
          <View style={[styles.notchLineTL, { backgroundColor: color }]} />
          <View style={[styles.notchLineBR, { backgroundColor: color }]} />
        </View>
      );
    default:
      return null;
  }
}

// ---------- Estado ----------
export function StatusPill({ status, small }: { status: PlayStatus; small?: boolean }) {
  const meta = STATUS_META[status];
  return (
    <View style={[styles.pill, { backgroundColor: meta.color + '26', borderColor: meta.color }]}>
      <Ionicons name={meta.icon as IconName} size={small ? 11 : 13} color={meta.color} />
      <ThemedText variant="bold" size={small ? 10 : 12} style={{ color: meta.color }}>
        {meta.short}
      </ThemedText>
    </View>
  );
}

export function RatingBadge({ rating, size = 'md' }: { rating: number; size?: 'md' | 'lg' }) {
  const skin = useSkin();
  const big = size === 'lg';
  return (
    <View
      style={[
        styles.rating,
        {
          backgroundColor: skin.colors.accent,
          width: big ? 64 : 34,
          height: big ? 64 : 34,
          borderRadius: big ? 32 : 17,
        },
      ]}
    >
      <ThemedText variant="display" size={big ? 28 : 15} style={{ color: skin.colors.onAccent }}>
        {Number.isInteger(rating) ? rating : rating.toFixed(1)}
      </ThemedText>
    </View>
  );
}

// ---------- Selector de estado ----------
export function StatusPicker({
  value,
  onChange,
}: {
  value: PlayStatus | null;
  onChange: (status: PlayStatus) => void;
}) {
  const skin = useSkin();
  return (
    <View style={styles.statusGrid}>
      {STATUS_ORDER.map((status) => {
        const meta = STATUS_META[status];
        const active = value === status;
        return (
          <Pressable
            key={status}
            onPress={() => onChange(status)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.statusItem,
              {
                borderRadius: Math.min(skin.radius, 14),
                borderColor: active ? meta.color : skin.colors.line,
                backgroundColor: active ? meta.color : skin.colors.panel,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons
              name={meta.icon as IconName}
              size={20}
              color={active ? '#ffffff' : meta.color}
            />
            <ThemedText
              variant="bold"
              size={12}
              numberOfLines={1}
              style={{ color: active ? '#ffffff' : skin.colors.text }}
            >
              {meta.short}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Selector de nota (1-10) ----------
export function RatingPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
}) {
  const skin = useSkin();
  return (
    <View style={styles.ratingRow}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const filled = value !== null && n <= value;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(value === n ? null : n)}
            accessibilityRole="button"
            accessibilityLabel={`Nota ${n}`}
            style={({ pressed }) => [
              styles.ratingCell,
              {
                backgroundColor: filled ? skin.colors.accent : skin.colors.panel2,
                borderRadius: Math.min(skin.radius, 8),
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <ThemedText
              variant="bold"
              size={13}
              style={{ color: filled ? skin.colors.onAccent : skin.colors.muted }}
            >
              {n}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Fila de juego (listas y biblioteca) ----------
type GameRowProps = {
  game: GameRecord;
  userGame?: UserGame;
  rank?: number;
  hours?: number | null;
  onPress?: () => void;
  right?: React.ReactNode;
  selected?: boolean;
};

export function GameRow({ game, userGame, rank, hours, onPress, right, selected }: GameRowProps) {
  const skin = useSkin();
  const meta = [game.year, userGame?.platform ?? game.platforms].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/game/${encodeURIComponent(game.id)}`))}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? skin.colors.panel2 : skin.colors.panel,
          borderColor: selected ? skin.colors.accent : skin.colors.line,
          borderWidth: selected ? 2 : skin.borderWidth,
          borderRadius: Math.min(skin.radius, 16),
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {rank !== undefined ? (
        <ThemedText variant="display" size={18} style={[styles.rank, { color: skin.colors.muted }]}>
          {rank}
        </ThemedText>
      ) : null}
      <GameCover game={game} width={52} />
      <View style={styles.rowBody}>
        <ThemedText variant="bold" size={15} numberOfLines={2}>
          {game.title}
        </ThemedText>
        <ThemedText variant="muted" size={12} numberOfLines={1}>
          {meta}
        </ThemedText>
        <View style={styles.rowTags}>
          {userGame ? <StatusPill status={userGame.status} small /> : null}
          {hours ? (
            <ThemedText variant="muted" size={11}>
              {hours} h
            </ThemedText>
          ) : null}
          {userGame?.favorite ? <Ionicons name="heart" size={12} color="#e66cc4" /> : null}
        </View>
      </View>
      {userGame?.rating != null ? <RatingBadge rating={userGame.rating} /> : null}
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  offset: { position: 'absolute', top: 5, left: 5 },
  inset4: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4 },
  inset3: { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3 },
  notchTL: { position: 'absolute', top: 0, left: 0, width: 0, height: 0, borderTopWidth: 16, borderRightWidth: 16, borderRightColor: 'transparent' },
  notchBR: { position: 'absolute', bottom: 0, right: 0, width: 0, height: 0, borderBottomWidth: 16, borderLeftWidth: 16, borderLeftColor: 'transparent' },
  notchLineTL: { position: 'absolute', top: 7.5, left: -3, width: 22.6, height: 1.5, transform: [{ rotate: '-45deg' }] },
  notchLineBR: { position: 'absolute', bottom: 7.5, right: -3, width: 22.6, height: 1.5, transform: [{ rotate: '-45deg' }] },
  initials: { color: 'rgba(255,255,255,0.9)' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  rating: { alignItems: 'center', justifyContent: 'center' },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusItem: {
    width: '23%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    borderWidth: 1,
  },
  ratingRow: { flexDirection: 'row', gap: 4 },
  ratingCell: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  rank: { width: 26, textAlign: 'center' },
  rowBody: { flex: 1, gap: 3 },
  rowTags: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
