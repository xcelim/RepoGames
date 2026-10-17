import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { GameCover, gameColors, RatingBadge, StatusPill } from '@/components/games';
import { ThemedText } from '@/components/ThemedText';
import { Chip, EmptyState, IconButton, Panel, type IconName } from '@/components/ui';
import { OFFICIAL_SERIES, officialListId } from '@/data/catalog';
import { STATUS_META } from '@/data/meta';
import { useGameDetails } from '@/hooks/useIgdb';
import { useGame } from '@/hooks/useLists';
import { useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';
import { formatDate } from '@/utils/format';
import { userGameKey } from '@/utils/library';

function Heading({ children }: { children: string }) {
  const skin = useSkin();
  return (
    <ThemedText variant="display" size={20} style={{ color: skin.colors.text }}>
      {children}
    </ThemedText>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <ThemedText variant="muted" size={13} style={styles.infoLabel}>
        {label}
      </ThemedText>
      <ThemedText size={14} style={styles.flex}>
        {value}
      </ThemedText>
    </View>
  );
}

function TimeTile({ label, hours, highlight }: { label: string; hours: number | null; highlight?: boolean }) {
  const skin = useSkin();
  return (
    <View
      style={[
        styles.timeTile,
        {
          backgroundColor: highlight ? skin.colors.accent : skin.colors.panel,
          borderColor: skin.colors.line,
          borderWidth: skin.borderWidth,
          borderRadius: Math.min(skin.radius, 14),
        },
      ]}
    >
      <ThemedText
        variant="display"
        size={24}
        style={{ color: highlight ? skin.colors.onAccent : skin.colors.text }}
      >
        {hours ? `${hours} h` : '–'}
      </ThemedText>
      <ThemedText size={11} style={{ color: highlight ? skin.colors.onAccent : skin.colors.muted }}>
        {label}
      </ThemedText>
    </View>
  );
}

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = decodeURIComponent(id ?? '');
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const game = useGame(gameId);
  const { details, loading } = useGameDetails(game);
  const [moreText, setMoreText] = useState(false);

  const profileId = useStore((s) => s.currentProfileId);
  const userGame = useStore((s) =>
    s.currentProfileId ? s.userGames[userGameKey(s.currentProfileId, gameId)] : undefined,
  );
  const storedGame = useStore((s) => s.games[gameId]);
  const upsertGame = useStore((s) => s.upsertGame);
  const lists = useStore((s) => s.lists);
  const items = useStore((s) => s.items);
  const mode = useStore((s) => s.durationMode);

  // Guarda en el juego los datos que faltaban (horas, portada) para las listas y estadísticas.
  useEffect(() => {
    if (!storedGame || !details) return;
    const t = details.timeToBeat;
    const patch = {
      coverUrl: storedGame.coverUrl ?? details.coverUrl,
      main: storedGame.main ?? t?.main ?? null,
      extra: storedGame.extra ?? t?.extra ?? null,
      full: storedGame.full ?? t?.full ?? null,
      synopsis: storedGame.synopsis ?? details.summary,
      platforms: storedGame.platforms || details.platforms.join(', '),
    };
    const changed = (Object.keys(patch) as (keyof typeof patch)[]).some((k) => patch[k] !== storedGame[k]);
    if (changed) upsertGame({ ...storedGame, ...patch });
  }, [details, storedGame, upsertGame]);

  const inLists = useMemo(() => {
    const ids = new Set(Object.values(items).filter((i) => i.gameId === gameId).map((i) => i.listId));
    return Object.values(lists).filter((l) => ids.has(l.id) && l.ownerId === profileId);
  }, [items, lists, gameId, profileId]);

  if (!game) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top + 40 }]}>
        <EmptyState icon="help-circle-outline" title="No encuentro este juego">
          <Button label="Volver" kind="ghost" onPress={() => router.back()} />
        </EmptyState>
      </View>
    );
  }

  const saga = OFFICIAL_SERIES.find((s) => s.id === game.series);
  const [c1, c2] = gameColors(game);
  const hero = details?.heroUrl ?? details?.screenshots[0] ?? details?.coverUrl ?? game.coverUrl;
  const cover = game.coverUrl ?? details?.coverUrl ?? null;
  const times = {
    main: game.main ?? details?.timeToBeat?.main ?? null,
    extra: game.extra ?? details?.timeToBeat?.extra ?? null,
    full: game.full ?? details?.timeToBeat?.full ?? null,
  };
  const release = formatDate(details?.releaseDate) ?? (game.year ? String(game.year) : null);
  const platforms = details?.platforms.length ? details.platforms.join(', ') : game.platforms;
  const description = game.synopsis ?? details?.summary ?? null;
  const original = game.synopsis && details?.summary ? details.summary : null;
  const statusMeta = userGame ? STATUS_META[userGame.status] : null;
  const edit = () => router.push(`/game/${encodeURIComponent(game.id)}/edit`);
  const heroHeight = Math.round(width * 0.62);
  const hasPlay =
    userGame &&
    (userGame.platform ||
      userGame.hoursPlayed ||
      userGame.startedAt ||
      userGame.finishedAt ||
      userGame.review ||
      userGame.liked.length ||
      userGame.disliked.length);

  const openTrailer = (videoId?: string) =>
    Linking.openURL(
      videoId
        ? `https://www.youtube.com/watch?v=${videoId}`
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${game.title} trailer`)}`,
    );

  const share = () => {
    const rating = userGame?.rating ? ` · mi nota: ${userGame.rating}/10` : '';
    Share.share({ message: `🎮 ${game.title}${game.year ? ` (${game.year})` : ''}${rating}\nVisto en Saga Quest` });
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48 }} showsVerticalScrollIndicator={false}>
      {/* ---------- Cabecera ---------- */}
      <View style={{ height: heroHeight }}>
        <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {hero ? <Image source={hero} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} /> : null}
        <LinearGradient
          colors={['rgba(0,0,0,0.45)', 'transparent', skin.colors.bg]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroTop, { top: insets.top + 6 }]}>
          <IconButton icon="chevron-back" label="Volver" color="#fff" onPress={() => router.back()} />
          <View style={styles.flex} />
          <IconButton icon="share-social-outline" label="Compartir" color="#fff" onPress={share} />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <GameCover game={game} width={108} url={cover} />
          <View style={styles.titleText}>
            <ThemedText variant="display" size={26}>
              {game.title}
            </ThemedText>
            {release ? (
              <ThemedText variant="muted" size={13}>
                {release}
              </ThemedText>
            ) : null}
            {details?.developers.length ? (
              <ThemedText variant="muted" size={13} numberOfLines={1}>
                {details.developers.join(', ')}
              </ThemedText>
            ) : null}
          </View>
        </View>

        {/* ---------- Notas ---------- */}
        <View style={styles.scores}>
          {details?.rating ? (
            <View style={styles.score}>
              <View style={[styles.scoreCircle, { borderColor: skin.colors.accent2 }]}>
                <ThemedText variant="display" size={22}>
                  {details.rating}
                </ThemedText>
              </View>
              <ThemedText variant="muted" size={11}>
                {details.ratingLabel}
                {details.ratingCount ? ` · ${details.ratingCount}` : ''}
              </ThemedText>
            </View>
          ) : null}
          <Pressable style={styles.score} onPress={edit}>
            {userGame?.rating ? (
              <RatingBadge rating={userGame.rating} size="lg" />
            ) : (
              <View style={[styles.scoreCircle, { borderColor: skin.colors.line, borderStyle: 'dashed' }]}>
                <Ionicons name="star-outline" size={24} color={skin.colors.muted} />
              </View>
            )}
            <ThemedText variant="muted" size={11}>
              {userGame?.rating ? 'Tu nota' : 'Puntuar'}
            </ThemedText>
          </Pressable>
          {userGame?.favorite ? (
            <View style={styles.score}>
              <View style={[styles.scoreCircle, { borderColor: '#e66cc4' }]}>
                <Ionicons name="heart" size={26} color="#e66cc4" />
              </View>
              <ThemedText variant="muted" size={11}>
                Favorito
              </ThemedText>
            </View>
          ) : null}
        </View>

        {/* ---------- Acciones ---------- */}
        <View style={styles.actions}>
          <Pressable
            onPress={edit}
            style={({ pressed }) => [
              styles.mainAction,
              {
                backgroundColor: statusMeta ? statusMeta.color : skin.colors.accent,
                borderRadius: Math.min(skin.radius, 14),
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name={(statusMeta?.icon ?? 'add') as IconName} size={20} color="#fff" />
            <ThemedText variant="bold" style={styles.white}>
              {statusMeta ? statusMeta.label : 'Añadir a mi biblioteca'}
            </ThemedText>
          </Pressable>
          <IconButton
            icon="folder-open-outline"
            label="Añadir a una lista"
            filled
            onPress={() => router.push(`/list/pick?gameId=${encodeURIComponent(game.id)}`)}
          />
          <IconButton icon="create-outline" label="Editar" filled onPress={edit} />
        </View>

        {/* ---------- Tu partida (solo lectura) ---------- */}
        {hasPlay ? (
          <Pressable onPress={edit}>
            <Panel>
              <View style={styles.rowBetween}>
                <Heading>Tu partida</Heading>
                {userGame ? <StatusPill status={userGame.status} /> : null}
              </View>
              <InfoRow label="Plataforma" value={userGame?.platform} />
              <InfoRow label="Horas" value={userGame?.hoursPlayed ? `${userGame.hoursPlayed} h` : null} />
              <InfoRow label="Empezado" value={formatDate(userGame?.startedAt)} />
              <InfoRow label="Terminado" value={formatDate(userGame?.finishedAt)} />
              <InfoRow label="Lo mejor" value={userGame?.liked.join(', ')} />
              <InfoRow label="Lo peor" value={userGame?.disliked.join(', ')} />
              {userGame?.review ? <ThemedText style={styles.review}>“{userGame.review}”</ThemedText> : null}
            </Panel>
          </Pressable>
        ) : null}

        {loading ? <ActivityIndicator color={skin.colors.accent} /> : null}

        {/* ---------- Cuánto dura ---------- */}
        {times.main || times.extra || times.full ? (
          <View style={styles.section}>
            <Heading>Cuánto dura</Heading>
            <View style={styles.times}>
              <TimeTile label="Historia" hours={times.main} highlight={mode === 'main'} />
              <TimeTile label="+ Secundarias" hours={times.extra} highlight={mode === 'extra'} />
              <TimeTile label="100 %" hours={times.full} highlight={mode === 'full'} />
            </View>
          </View>
        ) : null}

        {/* ---------- Resumen ---------- */}
        {description ? (
          <View style={styles.section}>
            <Heading>Resumen</Heading>
            <ThemedText numberOfLines={moreText ? undefined : 6}>{description}</ThemedText>
            {description.length > 280 ? (
              <ThemedText
                variant="bold"
                size={13}
                style={{ color: skin.colors.accent }}
                onPress={() => setMoreText((v) => !v)}
              >
                {moreText ? 'Ver menos' : 'Leer más'}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {game.version || game.note ? (
          <Panel>
            <View style={styles.rowStart}>
              <Ionicons name="sparkles" size={18} color={skin.colors.accent} />
              <ThemedText variant="bold">Versión recomendada</ThemedText>
            </View>
            {game.version ? <ThemedText>{game.version}</ThemedText> : null}
            {game.note ? (
              <ThemedText variant="muted" size={13}>
                {game.note}
              </ThemedText>
            ) : null}
          </Panel>
        ) : null}

        {/* ---------- Capturas y vídeos ---------- */}
        {details?.screenshots.length ? (
          <View style={styles.section}>
            <Heading>Capturas</Heading>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
              {details.screenshots.map((url) => (
                <Image
                  key={url}
                  source={url}
                  style={[styles.shot, { borderRadius: Math.min(skin.radius, 12) }]}
                  contentFit="cover"
                  transition={200}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <Heading>Vídeos</Heading>
          {details?.videoIds.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
              {details.videoIds.slice(0, 8).map((videoId) => (
                <Pressable key={videoId} onPress={() => openTrailer(videoId)}>
                  <Image
                    source={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                    style={[styles.shot, { borderRadius: Math.min(skin.radius, 12) }]}
                    contentFit="cover"
                  />
                  <View style={styles.play}>
                    <Ionicons name="play-circle" size={52} color="rgba(255,255,255,0.9)" />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Button kind="ghost" label="▶ Buscar tráiler en YouTube" onPress={() => openTrailer()} />
          )}
        </View>

        {/* ---------- Detalles ---------- */}
        <View style={styles.section}>
          <Heading>Detalles</Heading>
          <Panel>
            <InfoRow label="Lanzamiento" value={release} />
            <InfoRow label="Plataformas" value={platforms} />
            <InfoRow label="Géneros" value={details?.genres.join(', ')} />
            <InfoRow label="Desarrolla" value={details?.developers.join(', ')} />
            <InfoRow label="Distribuye" value={details?.publishers.join(', ')} />
            <InfoRow label="Saga" value={saga?.name ?? details?.franchise} />
          </Panel>
        </View>

        {original ? (
          <View style={styles.section}>
            <Heading>Descripción original</Heading>
            <ThemedText variant="muted" size={13}>
              {original}
            </ThemedText>
          </View>
        ) : null}

        {details?.storyline ? (
          <View style={styles.section}>
            <Heading>Argumento</Heading>
            <ThemedText variant="muted" size={13}>
              {details.storyline}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.section}>
          <Heading>En tus listas</Heading>
          <View style={styles.wrap}>
            {inLists.map((l) => (
              <Chip key={l.id} label={l.name} icon="folder" onPress={() => router.push(`/list/${l.id}`)} />
            ))}
            <Chip
              label="Añadir a una lista"
              icon="add"
              onPress={() => router.push(`/list/pick?gameId=${encodeURIComponent(game.id)}`)}
            />
          </View>
        </View>

        {saga ? (
          <Button kind="ghost" label={`Ver la saga ${saga.name}`} onPress={() => router.push(`/list/${officialListId(saga.id)}`)} />
        ) : null}

        <View style={styles.links}>
          <ThemedText
            variant="muted"
            size={12}
            style={styles.link}
            onPress={() => Linking.openURL(`https://howlongtobeat.com/?q=${encodeURIComponent(game.title)}`)}
          >
            HowLongToBeat
          </ThemedText>
          {details?.url ? (
            <ThemedText variant="muted" size={12} style={styles.link} onPress={() => Linking.openURL(details.url!)}>
              Datos de {details.source === 'igdb' ? 'IGDB' : 'RAWG'}
            </ThemedText>
          ) : null}
        </View>

        {!details && !loading ? (
          <Panel>
            <ThemedText variant="muted" size={13}>
              Conecta IGDB o RAWG en Ajustes para ver portada, capturas, vídeos, compañías y tiempos
              de cualquier juego.
            </ThemedText>
            <Button kind="ghost" label="Ir a Ajustes" onPress={() => router.push('/settings')} />
          </Panel>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  white: { color: '#ffffff' },
  heroTop: { position: 'absolute', left: 8, right: 8, flexDirection: 'row' },
  content: { paddingHorizontal: 16, gap: 20, marginTop: -70 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  titleText: { flex: 1, gap: 2, paddingBottom: 4 },
  scores: { flexDirection: 'row', gap: 18 },
  score: { alignItems: 'center', gap: 4 },
  scoreCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mainAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowStart: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoRow: { flexDirection: 'row', gap: 12 },
  infoLabel: { width: 96 },
  review: { fontStyle: 'italic' },
  section: { gap: 10 },
  times: { flexDirection: 'row', gap: 8 },
  timeTile: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 2 },
  gallery: { gap: 10, paddingRight: 16 },
  shot: { width: 260, height: 146 },
  play: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  link: { textDecorationLine: 'underline' },
});
