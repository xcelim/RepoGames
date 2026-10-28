// Piezas de interfaz calcadas de IGN Playlist, con los colores y letras de la estética elegida.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { createContext, memo, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';

import { platformBadge, SCORE_LABEL, scoreColor, STATUS_META } from '@/data/meta';
import { useSkin } from '@/theme/useSkin';
import type { GameList, GameRecord, PlayStatus } from '@/types';

import { Backdrop } from './Backdrop';
import { GameCover } from './games';
import { ReplayBadge } from './replayBadge';
import { ThemedText } from './ThemedText';
import type { IconName } from './ui';
import { refreshEverything } from '@/cloud/refresh';
import { goBack } from '@/utils/nav';

// ---------- Colores derivados ----------

export const glass = (hex: string) => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}e0` : hex);

export function useIgnColors() {
  const skin = useSkin();
  return {
    bg: skin.colors.bg,
    card: skin.colors.panel,
    soft: skin.colors.panel2,
    line: skin.colors.line,
    text: skin.colors.text,
    muted: skin.colors.muted,
    // El botón negro de IGN: en estéticas oscuras se vuelve claro.
    inverseBg: skin.colors.text,
    inverseText: skin.colors.bg,
    accent: skin.colors.accent,
    radius: Math.min(Math.max(skin.radius, 6), 18),
  };
}

// ---------- Tarjeta blanca ----------

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const c = useIgnColors();
  const skin = useSkin();
  return (
    <View
      style={[
        {
          // Un pelín transparente: deja asomar los dibujos de fondo de la estética.
          backgroundColor: glass(c.card),
          borderRadius: c.radius + 4,
          borderWidth: skin.borderWidth,
          borderColor: c.line,
          padding: padded ? 18 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// En la web, cada pantalla entra con un fundido suave (en el móvil ya hay animación nativa).
const WEB_ENTER =
  Platform.OS === 'web'
    ? ({
        animationName: 'sq-enter',
        animationDuration: '180ms',
        animationTimingFunction: 'ease-out',
      } as object)
    : null;

// ---------- Pantalla con título grande que se encoge al bajar ----------

type IgnScreenProps = {
  title: string;
  back?: boolean | (() => void);
  close?: boolean;
  right?: ReactNode;
  // Cabecera propia (por ejemplo la portada del juego). Si no, título grande a la izquierda.
  header?: ReactNode;
  hideLargeTitle?: boolean;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  // A partir de cuántos píxeles aparece la barra pequeña.
  collapseAt?: number;
  barTint?: string;
  // Además de actualizar todo al deslizar hacia abajo, lo propio de la pantalla.
  onRefresh?: () => Promise<unknown> | void;
  // Ancho máximo del contenido (en el PC, para que formularios y listas no queden estirados).
  narrow?: number;
} & Pick<ScrollViewProps, 'refreshControl' | 'keyboardShouldPersistTaps' | 'stickyHeaderIndices'>;

export function IgnScreen({
  title,
  back,
  close,
  right,
  header,
  hideLargeTitle,
  children,
  contentStyle,
  collapseAt = 56,
  barTint,
  onRefresh,
  refreshControl,
  narrow,
  ...rest
}: IgnScreenProps) {
  const [refreshing, setRefreshing] = useState(false);
  const pull = () => {
    setRefreshing(true);
    Promise.allSettled([refreshEverything(), Promise.resolve(onRefresh?.())]).finally(() => setRefreshing(false));
  };
  const c = useIgnColors();
  const insets = useSafeAreaInsets();
  const [scrollY] = useState(() => new Animated.Value(0));
  const [scrollEnd] = useState(createScrollEnd);
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: onScrollNearEnd(scrollEnd) as never,
      }),
    [scrollY, scrollEnd],
  );
  const barOpacity = scrollY.interpolate({
    inputRange: [collapseAt - 20, collapseAt + 10],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const onBack = typeof back === 'function' ? back : () => goBack();

  const backButton =
    back || close ? (
      <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
        <Ionicons name={close ? 'close' : 'chevron-back'} size={24} color={c.text} />
      </Pressable>
    ) : (
      <View style={styles.backBtn} />
    );

  return (
    <View style={[{ flex: 1, backgroundColor: c.bg }, WEB_ENTER]}>
      <Backdrop />
      <Animated.ScrollView
        {...rest}
        refreshControl={
          refreshControl ?? (
            <RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={c.text} colors={[c.accent]} />
          )
        }
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentContainerStyle={[
          { paddingBottom: insets.bottom + 110 },
          narrow ? { width: '100%', maxWidth: narrow, alignSelf: 'center' } : null,
          contentStyle,
        ]}
      >
        {header ?? (
          <View style={[styles.largeHeader, { paddingTop: insets.top + 10 }]}>
            {back || close ? (
              <Pressable onPress={onBack} hitSlop={12} style={styles.backRow}>
                <Ionicons name={close ? 'close' : 'chevron-back'} size={20} color={c.text} />
                <ThemedText size={16}>{close ? 'Cerrar' : 'Atrás'}</ThemedText>
              </Pressable>
            ) : null}
            <View style={styles.titleRow}>
              {!hideLargeTitle ? (
                <ThemedText variant="display" size={32} style={styles.largeTitle} numberOfLines={2}>
                  {title}
                </ThemedText>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              {right ? <View style={styles.rightIcons}>{right}</View> : null}
            </View>
          </View>
        )}
        <ScrollEndContext.Provider value={scrollEnd}>{children}</ScrollEndContext.Provider>
      </Animated.ScrollView>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.smallBar,
          { paddingTop: insets.top, backgroundColor: barTint ?? c.bg, borderBottomColor: c.line, opacity: barOpacity },
        ]}
      >
        <View style={styles.smallBarInner}>
          {backButton}
          <ThemedText variant="bold" size={13} numberOfLines={1} style={styles.smallTitle}>
            {title.toUpperCase()}
          </ThemedText>
          <View style={styles.backBtn} />
        </View>
      </Animated.View>
    </View>
  );
}

// Ancho útil de una pantalla con «narrow» (en el móvil es el de siempre).
export function useScreenWidth(narrow?: number): number {
  const { width } = useWindowDimensions();
  return narrow ? Math.min(width, narrow) : width;
}

// ---------- Pintar poco a poco las rejillas largas ----------
// La pantalla avisa cuando el scroll se acerca al final y las rejillas pintan más portadas:
// así abrir una biblioteca de 400 juegos solo dibuja las primeras y va fluido.

type EndListener = () => void;
export type ScrollEnd = { subscribe: (fn: EndListener) => () => void; emit: () => void };

export function createScrollEnd(): ScrollEnd {
  const listeners = new Set<EndListener>();
  return {
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    emit: () => listeners.forEach((fn) => fn()),
  };
}

export const ScrollEndContext = createContext<ScrollEnd | null>(null);

export function onScrollNearEnd(end: ScrollEnd, margin = 1200) {
  return (e: {
    nativeEvent: {
      layoutMeasurement: { height: number };
      contentOffset: { y: number };
      contentSize: { height: number };
    };
  }) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - margin) end.emit();
  };
}

// Cuántos elementos pintar: empieza con pocos y crece al bajar (o del todo si no hay scroll que avise).
export function useProgressive(total: number, first = 12, step = 16): number {
  const end = useContext(ScrollEndContext);
  const [count, setCount] = useState(first);
  useEffect(() => {
    if (!end) return;
    return end.subscribe(() => setCount((n) => (n < total ? n + step : n)));
  }, [end, total, step]);
  return end ? Math.min(total, count) : total;
}

// Icono redondo de cabecera (⊕, buscar, compartir...).
export function HeaderIcon({ icon, onPress, label }: { icon: IconName; onPress: () => void; label?: string }) {
  const c = useIgnColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
    >
      <Ionicons name={icon} size={28} color={c.text} />
    </Pressable>
  );
}

// ---------- Botones ----------

export function DarkButton({
  label,
  onPress,
  disabled,
  style,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: IconName;
}) {
  const c = useIgnColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.darkBtn,
        { backgroundColor: disabled ? c.soft : c.inverseBg, borderRadius: c.radius, opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={disabled ? c.muted : c.inverseText} /> : null}
      <ThemedText variant="bold" size={16} style={{ color: disabled ? c.muted : c.inverseText }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function LightButton({
  label,
  onPress,
  style,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  icon?: IconName;
}) {
  const c = useIgnColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.darkBtn,
        {
          backgroundColor: c.soft,
          borderRadius: c.radius,
          borderWidth: 1,
          borderColor: c.line,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={c.text} /> : null}
      <ThemedText variant="bold" size={16}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function DotsButton({ onPress }: { onPress: () => void }) {
  const c = useIgnColors();
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.dots} accessibilityLabel="Más opciones">
      <Ionicons name="ellipsis-horizontal" size={26} color={c.text} />
    </Pressable>
  );
}

// ---------- Estado ----------

export function StatusIcon({ status, size = 34 }: { status: PlayStatus; size?: number }) {
  const meta = STATUS_META[status];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: meta.color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={meta.icon as IconName} size={size * 0.56} color="#fff" />
    </View>
  );
}

// La pastilla de color que va sobre la portada ("Jugando ⁘").
export function StatusBadge({ status, compact }: { status: PlayStatus; compact?: boolean }) {
  const meta = STATUS_META[status];
  return (
    <View style={[styles.badge, { backgroundColor: meta.color }]}>
      {!compact ? (
        <ThemedText variant="bold" size={10} style={{ color: '#fff' }}>
          {meta.short}
        </ThemedText>
      ) : null}
      <View style={styles.badgeIcon}>
        <Ionicons name={meta.icon as IconName} size={10} color={meta.color} />
      </View>
    </View>
  );
}

export function RankCircle({ rank, size = 26 }: { rank: number; size?: number }) {
  const c = useIgnColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.inverseBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ThemedText variant="bold" size={size * 0.46} style={{ color: c.inverseText }}>
        {rank}
      </ThemedText>
    </View>
  );
}

// ---------- Portada con título (rejillas y carruseles) ----------

function CoverTileInner({
  game,
  width,
  status,
  rank,
  onPress,
  onAdd,
  subtitle,
  onLongPress,
  replays,
  onReplays,
  physical,
  note,
}: {
  game: GameRecord;
  width: number;
  status?: PlayStatus | null;
  rank?: number;
  onPress: () => void;
  onLongPress?: () => void;
  onAdd?: () => void;
  subtitle?: string | null;
  replays?: number; // veces rejugado (icono arriba a la derecha)
  onReplays?: () => void; // si se puede tocar para cambiarlo
  physical?: boolean;
  note?: string;
}) {
  const c = useIgnColors();
  const sub = subtitle !== undefined ? subtitle : (game.developer ?? (game.year ? String(game.year) : null));
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.85 : 1 }]}
    >
      <View>
        <GameCover game={game} width={width} radius={c.radius} />
        {status ? (
          <View style={styles.coverBadge}>
            <StatusBadge status={status} />
          </View>
        ) : onAdd ? (
          <Pressable onPress={onAdd} hitSlop={6} style={styles.coverBadge}>
            <View style={styles.addPill}>
              <ThemedText variant="bold" size={11} style={{ color: '#fff' }}>
                Añadir
              </ThemedText>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
            </View>
          </Pressable>
        ) : null}
        {replays || onReplays ? (
          <Pressable
            disabled={!onReplays}
            onPress={onReplays}
            hitSlop={8}
            style={styles.replayCorner}
            accessibilityLabel={`Rejugado ${replays ?? 0} veces`}
          >
            <ReplayBadge count={replays ?? 0} size={Math.max(28, Math.min(36, width * 0.2))} dim={!replays} />
          </Pressable>
        ) : null}
        {physical ? (
          <View style={styles.physicalCorner} accessibilityLabel="Lo tienes en físico">
            <Ionicons name="disc" size={14} color="#fff" />
          </View>
        ) : null}
      </View>
      <View style={styles.tileText}>
        {rank != null ? <RankCircle rank={rank} /> : null}
        <View style={{ flex: 1 }}>
          <ThemedText size={14} numberOfLines={2}>
            {game.title}
          </ThemedText>
          {sub ? (
            <ThemedText variant="muted" size={11} numberOfLines={1} style={styles.caps}>
              {sub.toUpperCase()}
            </ThemedText>
          ) : null}
          {note ? (
            <ThemedText variant="muted" size={12} numberOfLines={2} style={{ fontStyle: 'italic', marginTop: 3 }}>
              “{note}”
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// Las funciones cambian en cada pintado pero hacen lo mismo con el mismo juego:
// solo se vuelve a pintar la portada si cambian sus datos.
export const CoverTile = memo(CoverTileInner, (a, b) => {
  for (const k of Object.keys({ ...a, ...b }) as (keyof typeof a)[]) {
    if (typeof a[k] === 'function' || typeof b[k] === 'function') {
      if (!a[k] !== !b[k]) return false;
      continue;
    }
    if (a[k] !== b[k]) return false;
  }
  return true;
});

// ---------- Mosaico de portadas de una lista ----------

export function Mosaic({
  list,
  games,
  size,
  radius,
}: {
  list: Pick<GameList, 'color' | 'color2' | 'icon'>;
  games: GameRecord[];
  size: number;
  radius?: number;
}) {
  const c = useIgnColors();
  const r = radius ?? c.radius;
  const shown = games.slice(0, 4);
  return (
    <View style={{ width: size, height: size, borderRadius: r, overflow: 'hidden' }}>
      <LinearGradient
        colors={[list.color, list.color2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {shown.length === 0 ? (
        <View style={styles.mosaicEmpty}>
          <Ionicons name={(list.icon || 'albums') as IconName} size={size * 0.38} color="rgba(255,255,255,0.9)" />
        </View>
      ) : shown.length < 4 ? (
        <GameCover game={shown[0]} width={size} square radius={0} />
      ) : (
        <View style={styles.mosaicGrid}>
          {shown.map((g) => (
            <GameCover key={g.id} game={g} width={size / 2} square radius={0} />
          ))}
        </View>
      )}
    </View>
  );
}

// Collage ancho (Featured Playlists): portadas en tira.
export function Collage({
  list,
  games,
  width,
  height,
}: {
  list: Pick<GameList, 'color' | 'color2' | 'icon'>;
  games: GameRecord[];
  width: number;
  height: number;
}) {
  const c = useIgnColors();
  const shown = games.slice(0, 4);
  const slice = shown.length ? width / Math.min(shown.length, 3) : width;
  return (
    <View style={{ width, height, borderRadius: c.radius + 2, overflow: 'hidden' }}>
      <LinearGradient
        colors={[list.color, list.color2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {shown.length ? (
        <View style={{ flexDirection: 'row', height }}>
          {shown.slice(0, 3).map((g) => (
            <View key={g.id} style={{ width: slice, height, overflow: 'hidden' }}>
              <GameCover game={g} width={Math.max(slice, height * 0.75)} radius={0} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.mosaicEmpty}>
          <Ionicons name={(list.icon || 'albums') as IconName} size={height * 0.3} color="rgba(255,255,255,0.9)" />
        </View>
      )}
    </View>
  );
}

// ---------- Fondo borroso de color (cabeceras de juego y lista) ----------

export function BlurHero({ url, colors, height }: { url: string | null; colors: [string, string]; height: number }) {
  const c = useIgnColors();
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height, overflow: 'hidden' }}>
      <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
      {url ? <Image source={url} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} /> : null}
      <LinearGradient
        colors={['rgba(0,0,0,0)', c.bg]}
        start={{ x: 0, y: 0.35 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

// ---------- Plataformas ----------

export function PlatformChips({
  platforms,
  max = 6,
  size = 'sm',
}: {
  platforms: string[];
  max?: number;
  size?: 'sm' | 'md';
}) {
  const seen = new Set<string>();
  const badges = platforms.map(platformBadge).filter((b) => (seen.has(b.label) ? false : (seen.add(b.label), true)));
  const shown = badges.slice(0, max);
  const extra = badges.length - shown.length;
  const big = size === 'md';
  return (
    <View style={styles.chipsRow}>
      {shown.map((b) => (
        <View
          key={b.label}
          style={[
            styles.platChip,
            { backgroundColor: b.color, paddingHorizontal: big ? 6 : 4, paddingVertical: big ? 3 : 1 },
          ]}
        >
          <ThemedText variant="bold" size={big ? 11 : 8} style={{ color: '#fff' }}>
            {b.label}
          </ThemedText>
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.platChip,
            { backgroundColor: '#2a2d36', paddingHorizontal: big ? 6 : 4, paddingVertical: big ? 3 : 1 },
          ]}
        >
          <ThemedText variant="bold" size={big ? 11 : 8} style={{ color: '#fff' }}>
            +{extra}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

export function splitPlatforms(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// ---------- Notas ----------

// Hexágono rojo de "nota de la crítica" (0-10).
export function ScoreHex({ score, size = 46 }: { score: number | null; size?: number }) {
  const c = useIgnColors();
  const color = score == null ? c.soft : '#d6232a';
  const s = size;
  const pts = [
    [s / 2, 0],
    [s, s * 0.25],
    [s, s * 0.75],
    [s / 2, s],
    [0, s * 0.75],
    [0, s * 0.25],
  ]
    .map((p) => p.join(','))
    .join(' ');
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} style={StyleSheet.absoluteFill}>
        <Polygon points={pts} fill={color} />
      </Svg>
      <ThemedText variant="bold" size={s * 0.4} style={{ color: score == null ? c.muted : '#fff' }}>
        {score == null ? '–' : formatScore(score)}
      </ThemedText>
    </View>
  );
}

export function ScoreSquare({ score, size = 46, neutral }: { score: number | null; size?: number; neutral?: string }) {
  const c = useIgnColors();
  const bg = neutral ? c.soft : score == null ? c.soft : scoreColor(score);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.16,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ThemedText
        variant="bold"
        size={size * (neutral ? 0.32 : 0.4)}
        style={{ color: neutral || score == null ? c.text : '#fff' }}
      >
        {neutral ?? (score == null ? '–' : formatScore(score))}
      </ThemedText>
    </View>
  );
}

export function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export function scoreLabel(score: number | null | undefined): string {
  if (score == null) return 'Sin nota';
  return SCORE_LABEL[Math.max(1, Math.min(10, Math.round(score)))];
}

// ---------- Gráficos ----------

export function Donut({
  parts,
  size = 110,
  stroke = 16,
}: {
  parts: { value: number; color: string }[];
  size?: number;
  stroke?: number;
}) {
  const c = useIgnColors();
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.soft} strokeWidth={stroke} fill="none" />
      {total > 0
        ? parts
            .filter((p) => p.value > 0)
            .map((p, i) => {
              const len = (p.value / total) * circ;
              const el = (
                <Circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={p.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${Math.max(len - 2, 0.1)} ${circ}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
              offset += len;
              return el;
            })
        : null}
    </Svg>
  );
}

// Iconito de tarta (¼, ½, lleno) para las filas de "Cuánto dura".
export function PieIcon({ fraction, size = 20 }: { fraction: number; size?: number }) {
  const c = useIgnColors();
  const r = size / 2 - 1.5;
  const cx = size / 2;
  const angle = fraction * 2 * Math.PI;
  const x = cx + r * Math.sin(angle);
  const y = cx - r * Math.cos(angle);
  const large = fraction > 0.5 ? 1 : 0;
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cx} r={r} stroke={c.text} strokeWidth={1.5} fill="none" />
      {fraction >= 1 ? (
        <Circle cx={cx} cy={cx} r={r} fill={c.text} />
      ) : (
        <Path d={`M ${cx} ${cx} L ${cx} ${cx - r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`} fill={c.text} />
      )}
    </Svg>
  );
}

// ---------- Hoja central (los menús de IGN) ----------

export function Sheet({
  visible,
  title,
  onClose,
  children,
  doneLabel = 'Hecho',
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  doneLabel?: string | null;
  footer?: ReactNode;
}) {
  const c = useIgnColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.sheetBackdrop, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: c.card, borderRadius: c.radius + 10 }]}>
          <ThemedText variant="bold" size={11} style={styles.sheetTitle} numberOfLines={1}>
            {title.toUpperCase()}
          </ThemedText>
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer}
          {doneLabel ? <DarkButton label={doneLabel} onPress={onClose} style={{ marginTop: 10 }} /> : null}
        </View>
      </View>
    </Modal>
  );
}

export function SheetRow({
  label,
  caption,
  left,
  right,
  onPress,
  selected,
  last,
}: {
  label: string;
  caption?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  last?: boolean;
}) {
  const c = useIgnColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sheetRow,
        {
          borderBottomColor: c.line,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          backgroundColor: selected ? c.soft : 'transparent',
          borderRadius: selected ? c.radius : 0,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      {left}
      <View style={{ flex: 1 }}>
        <ThemedText variant={selected ? 'bold' : 'body'} size={15} numberOfLines={1}>
          {label}
        </ThemedText>
        {caption ? (
          <ThemedText variant="muted" size={10} style={styles.caps} numberOfLines={1}>
            {caption}
          </ThemedText>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

// ---------- Interruptor ----------

export function ToggleRow({
  label,
  value,
  onChange,
  caption,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  caption?: string;
}) {
  const c = useIgnColors();
  return (
    <View style={[styles.toggleRow, { backgroundColor: c.card, borderColor: c.line, borderRadius: c.radius }]}>
      <View style={{ flex: 1 }}>
        <ThemedText size={14}>{label}</ThemedText>
        {caption ? (
          <ThemedText variant="muted" size={11}>
            {caption}
          </ThemedText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: c.inverseBg, false: c.soft }}
        thumbColor={value ? c.inverseText : c.muted}
      />
    </View>
  );
}

// ---------- Desplegable de orden ----------

export function SelectBox({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useIgnColors();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.selectBox, { borderColor: c.text, borderRadius: c.radius / 2, backgroundColor: c.card }]}
    >
      <ThemedText size={14} numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </ThemedText>
      <Ionicons name="chevron-down" size={18} color={c.muted} />
    </Pressable>
  );
}

// ---------- Fila de juego (listas y ordenar) ----------

export function GameLine({
  game,
  rank,
  status,
  onPress,
  right,
  showPlatforms = true,
  caption,
}: {
  game: GameRecord;
  rank?: number;
  status?: PlayStatus | null;
  onPress?: () => void;
  right?: ReactNode;
  showPlatforms?: boolean;
  caption?: string; // texto destacado (por ejemplo «Quedan 6 días»)
}) {
  const c = useIgnColors();
  const date = formatUsDate(game.releaseDate) ?? (game.year ? String(game.year) : null);
  const line = [date, game.developer].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.gameLine, { borderBottomColor: c.line, opacity: pressed ? 0.7 : 1 }]}
    >
      {rank != null ? <RankCircle rank={rank} /> : null}
      <View>
        <GameCover game={game} width={64} square radius={6} />
        {status ? (
          <View style={styles.lineBadge}>
            <StatusBadge status={status} compact />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <ThemedText size={15} numberOfLines={1}>
          {game.title}
        </ThemedText>
        {caption ? (
          <ThemedText variant="bold" size={13} style={{ color: c.accent }} numberOfLines={1}>
            {caption}
          </ThemedText>
        ) : null}
        {line ? (
          <ThemedText variant="muted" size={12} numberOfLines={1}>
            {line}
          </ThemedText>
        ) : null}
        {showPlatforms ? <PlatformChips platforms={splitPlatforms(game.platforms)} /> : null}
      </View>
      {right}
    </Pressable>
  );
}

// "2021-09-16" -> "16.09.2021" (día.mes.año).
export function formatUsDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return null;
  return `${d}.${m}.${y}`;
}

// "hace 15 días"
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `hace ${mo} ${mo === 1 ? 'mes' : 'meses'}`;
  const y = Math.round(mo / 12);
  return `hace ${y} ${y === 1 ? 'año' : 'años'}`;
}

// ---------- Cabecera de sección con flecha ----------

export function SectionHeader({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  const c = useIgnColors();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <ThemedText variant="display" size={22} style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </ThemedText>
        {onPress ? (
          <View style={styles.seeAll}>
            <ThemedText variant="bold" size={12} style={{ color: c.muted }}>
              Ver todo
            </ThemedText>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </View>
        ) : null}
      </View>
      {subtitle ? (
        <ThemedText variant="muted" size={13} numberOfLines={2}>
          {subtitle}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  replayCorner: { position: 'absolute', top: 6, right: 6 },
  physicalCorner: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeHeader: { paddingHorizontal: 20, paddingBottom: 8, gap: 8, alignSelf: 'stretch' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingVertical: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  largeTitle: { flex: 1 },
  rightIcons: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  smallBar: { position: 'absolute', left: 0, right: 0, top: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  smallBarInner: { height: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  smallTitle: { flex: 1, textAlign: 'center', letterSpacing: 1 },
  backBtn: { width: 32, alignItems: 'flex-start' },
  darkBtn: {
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dots: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingLeft: 7,
    paddingRight: 3,
    paddingVertical: 2,
  },
  badgeIcon: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBadge: { position: 'absolute', right: 6, bottom: 6 },
  lineBadge: { position: 'absolute', right: -4, bottom: -4 },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 3,
    paddingVertical: 2,
  },
  tileText: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-start' },
  caps: { letterSpacing: 0.8, marginTop: 2 },
  mosaicEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mosaicGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  platChip: { borderRadius: 3 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 18 },
  sheet: { padding: 18, maxHeight: '100%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  sheetTitle: { textAlign: 'center', letterSpacing: 1.5, marginBottom: 14 },
  sheetScroll: { flexGrow: 0 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1 },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  gameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: { paddingHorizontal: 20, gap: 4, marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

// ---------- Rejilla de dos columnas (listas y biblioteca) ----------

export function EntryGrid({
  entries,
  width,
  showRank,
  onPress,
  onLongPress,
  onReplays,
}: {
  entries: {
    game: GameRecord;
    status?: PlayStatus | null;
    rank: number;
    replays?: number;
    physical?: boolean;
    note?: string;
    subtitle?: string;
  }[];
  width: number;
  showRank: boolean;
  onPress: (game: GameRecord) => void;
  onLongPress?: (game: GameRecord) => void;
  onReplays?: (game: GameRecord) => void;
}) {
  // Dos columnas en el móvil; en pantallas anchas (web en el PC), las que quepan.
  const cols = Math.max(2, Math.floor((width - 40 + 14) / (196 + 14)));
  const tileW = (width - 20 * 2 - 14 * (cols - 1)) / cols;
  const count = useProgressive(entries.length, cols * 6, cols * 6);
  return (
    <View style={gridStyles.grid}>
      {entries.slice(0, count).map((e, i) => (
        <CoverTile
          key={`${e.game.id}-${i}`}
          game={e.game}
          width={tileW}
          status={e.status}
          rank={showRank ? e.rank : undefined}
          onPress={() => onPress(e.game)}
          onLongPress={onLongPress ? () => onLongPress(e.game) : undefined}
          replays={e.replays}
          onReplays={onReplays ? () => onReplays(e.game) : undefined}
          physical={e.physical}
          note={e.note}
          subtitle={e.subtitle}
        />
      ))}
    </View>
  );
}

const gridStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, rowGap: 24, paddingHorizontal: 20 },
});

// ---------- Barra de % completado de una lista ----------

export function ProgressBar({ pct, height = 6, color }: { pct: number; height?: number; color?: string }) {
  const c = useIgnColors();
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: c.soft, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          height: '100%',
          backgroundColor: color ?? '#6aa834',
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}
