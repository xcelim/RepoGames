import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AchievementsCard } from '@/components/achievements';
import { PlayDetails } from '@/components/details';
import { PriceCard } from '@/components/PriceCard';
import { GameCover, gameColors } from '@/components/games';
import { useGameSheets } from '@/components/gameSheets';
import {
  BlurHero,
  Card,
  DarkButton,
  DotsButton,
  formatScore,
  formatUsDate,
  IgnScreen,
  Mosaic,
  PieIcon,
  PlatformChips,
  ScoreHex,
  ScoreSquare,
  scoreLabel,
  splitPlatforms,
  StatusBadge,
  StatusIcon,
  useIgnColors,
} from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { Avatar } from '@/components/ui';
import { OFFICIAL_LISTS } from '@/data/catalog';
import { STATUS_META } from '@/data/meta';
import { useGameDetails } from '@/hooks/useIgdb';
import { useCommunityLists, useGame, useListCount, useListPreview, useMyLists } from '@/hooks/useLists';
import { useStore } from '@/store/useStore';
import { daysSince } from '@/utils/fun';
import { userGameKey } from '@/utils/library';
import { finishEta } from '@/utils/stats';
import { longDate } from '@/hooks/useMyGames';
import type { GameDetails } from '@/api/types';
import type { GameRecord } from '@/types';
import { goBack } from '@/utils/nav';

type Tab = 'overview' | 'lists' | 'reviews';

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = decodeURIComponent(id ?? '');
  const c = useIgnColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const game = useGame(gameId);
  const { details, loading } = useGameDetails(game);
  const [tab, setTab] = useState<Tab>('overview');
  const sheets = useGameSheets();

  const userGame = useStore((s) =>
    s.currentProfileId ? s.userGames[userGameKey(s.currentProfileId, gameId)] : undefined,
  );
  const storedGame = useStore((s) => s.games[gameId]);
  const upsertGame = useStore((s) => s.upsertGame);

  // Guarda en el juego lo que faltaba (horas, portada, desarrolladora...) para listas y estadísticas.
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
      developer: storedGame.developer ?? details.developers[0] ?? null,
      releaseDate: storedGame.releaseDate ?? details.releaseDate,
      criticRating: storedGame.criticRating ?? details.criticRating ?? details.rating,
    };
    const changed = (Object.keys(patch) as (keyof typeof patch)[]).some((k) => patch[k] !== storedGame[k]);
    if (changed) upsertGame({ ...storedGame, ...patch });
  }, [details, storedGame, upsertGame]);

  if (!game) {
    return (
      <IgnScreen title="Juego" back>
        <ThemedText variant="muted" style={{ paddingHorizontal: 20 }}>
          No encuentro este juego.
        </ThemedText>
      </IgnScreen>
    );
  }

  const cover = game.coverUrl ?? details?.coverUrl ?? null;
  const developer = details?.developers[0] ?? game.developer ?? null;
  const release = details?.releaseDate ?? game.releaseDate ?? null;
  const platforms = details?.platforms.length ? details.platforms : splitPlatforms(game.platforms);
  const critic = details?.criticRating ?? details?.rating ?? game.criticRating ?? null;
  const users = details?.userRating ?? null;
  const status = userGame?.status;
  const coverW = Math.min(width * 0.5, 220);

  const header = (
    <View style={{ paddingTop: insets.top + 6 }}>
      <BlurHero url={cover} colors={gameColors(game)} height={insets.top + 50 + coverW * 0.75} />
      <Pressable onPress={() => goBack()} style={styles.backRow} hitSlop={10}>
        <Ionicons name="chevron-back" size={20} color="#fff" />
        <ThemedText size={16} style={{ color: '#fff' }}>
          Atrás
        </ThemedText>
      </Pressable>
      <View style={styles.coverWrap}>
        <Pressable
          onPress={() => router.push(`/holo/${encodeURIComponent(game.id)}`)}
          accessibilityLabel="Ver como carta holográfica"
        >
          <GameCover game={game} width={coverW} url={cover} radius={c.radius} />
          {status ? (
            <View style={styles.coverBadge}>
              <StatusBadge status={status} />
            </View>
          ) : null}
          <View style={styles.holoHint}>
            <Ionicons name="sparkles" size={14} color="#fff" />
          </View>
        </Pressable>
      </View>
      <Pressable
        disabled={!details?.url}
        onPress={() => details?.url && Linking.openURL(details.url)}
        style={styles.titleRow}
      >
        <ThemedText variant="display" size={26} style={styles.title}>
          {game.title}
        </ThemedText>
        {details?.url ? (
          <Ionicons name="arrow-up-outline" size={20} color={c.text} style={{ transform: [{ rotate: '45deg' }] }} />
        ) : null}
      </Pressable>
      <ThemedText variant="muted" size={13} style={styles.center}>
        {[developer, formatUsDate(release) ?? game.year].filter(Boolean).join(' · ')}
      </ThemedText>
      {platforms.length ? (
        <View style={styles.platforms}>
          <PlatformChips platforms={platforms} size="md" max={8} />
        </View>
      ) : null}
    </View>
  );

  return (
    <IgnScreen title={game.title} header={header} collapseAt={coverW * 1.33 + 140}>
      <View style={styles.block}>
        <Card style={styles.scores} padded={false}>
          <ScoreCol label="Crítica" onPress={() => details?.url && Linking.openURL(details.url)}>
            <ScoreHex score={critic != null ? critic / 10 : null} size={44} />
          </ScoreCol>
          <ScoreCol label="Tu nota" onPress={() => router.push(`/game/${encodeURIComponent(game.id)}/review`)}>
            <ScoreSquare score={userGame?.rating ?? null} size={44} />
          </ScoreCol>
          <ScoreCol label={details?.userCount ? `${details.userCount} notas` : 'Jugadores'}>
            <ScoreSquare score={users != null ? Math.round(users) / 10 : null} size={44} />
          </ScoreCol>
          <ScoreCol label={userGame?.recommend == null ? 'Recomendado' : 'Lo recomiendas'}>
            <ScoreSquare
              score={null}
              size={44}
              neutral={userGame?.recommend == null ? '–' : userGame.recommend ? 'Sí' : 'No'}
            />
          </ScoreCol>
        </Card>
        <View style={styles.editRow}>
          <DarkButton label="Editar estado" onPress={() => sheets.openStatus(game)} style={{ flex: 1 }} />
          <DotsButton onPress={() => sheets.openMore(game)} />
        </View>
      </View>

      <View style={[styles.tabs, { borderBottomColor: c.line }]}>
        {(
          [
            ['overview', 'Resumen'],
            ['lists', 'Listas'],
            ['reviews', 'Reseñas'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && { borderBottomColor: c.text }]}
          >
            <ThemedText
              variant={tab === key ? 'bold' : 'body'}
              size={14}
              style={{ color: tab === key ? c.text : c.muted }}
            >
              {label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.tabBody}>
        {tab === 'overview' ? (
          <Overview game={game} details={details} loading={loading} />
        ) : tab === 'lists' ? (
          <ListsTab gameId={game.id} onOrganize={() => sheets.openOrganize(game)} />
        ) : (
          <ReviewsTab gameId={game.id} />
        )}
      </View>
      {sheets.element}
    </IgnScreen>
  );
}

function ScoreCol({ label, children, onPress }: { label: string; children: React.ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.scoreCol}>
      {children}
      <ThemedText variant="muted" size={10} numberOfLines={1} style={{ textDecorationLine: 'underline' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

// ---------- Resumen ----------

function Overview({
  game,
  details,
  loading,
  hideAchievements,
}: {
  game: GameRecord;
  details: GameDetails | null;
  loading: boolean;
  hideAchievements?: boolean;
}) {
  const c = useIgnColors();
  const gameId = game.id;
  const userGame = useStore((s) =>
    s.currentProfileId ? s.userGames[userGameKey(s.currentProfileId, gameId)] : undefined,
  );
  const [gallery, setGallery] = useState<number | null>(null);
  const [moreText, setMoreText] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);
  const { width } = useWindowDimensions();

  const times = {
    main: game.main ?? details?.timeToBeat?.main ?? null,
    extra: game.extra ?? details?.timeToBeat?.extra ?? null,
    full: game.full ?? details?.timeToBeat?.full ?? null,
  };
  const known = [times.main, times.extra, times.full].filter((h): h is number => h != null);
  const eta = userGame ? finishEta(userGame, times.main ?? times.extra) : null;
  const average = known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : null;
  const shots = details?.screenshots ?? [];
  const video = details?.videoIds[0];
  const summary = details?.summary ?? game.synopsis;
  const innerW = width - 40 - 36;

  const fields: [string, string[] | string | null | undefined][] = [
    ['Desarrolladores', details?.developers ?? (game.developer ? [game.developer] : [])],
    ['Distribuidoras', details?.publishers],
    [
      'Fecha de lanzamiento',
      formatUsDate(details?.releaseDate ?? game.releaseDate) ?? (game.year ? String(game.year) : null),
    ],
    ['Franquicia', details?.franchise],
    ['Géneros', details?.genres],
    ['Temáticas', details?.themes],
    ['Modos', details?.modes],
    ['Plataformas', details?.platforms.length ? details.platforms : splitPlatforms(game.platforms)],
  ];

  return (
    <View style={{ gap: 18 }}>
      {loading && !details ? <ActivityIndicator color={c.text} /> : null}

      <Card>
        <Pressable
          onPress={() => Linking.openURL(`https://howlongtobeat.com/?q=${encodeURIComponent(game.title)}`)}
          style={styles.cardTitleRow}
        >
          <ThemedText variant="display" size={19}>
            Cuánto dura
          </ThemedText>
          <Ionicons name="arrow-up-outline" size={18} color={c.text} style={{ transform: [{ rotate: '45deg' }] }} />
        </Pressable>
        <View style={[styles.bigCircle, { backgroundColor: c.inverseBg }]}>
          <ThemedText variant="bold" size={22} style={{ color: c.inverseText }}>
            {average != null ? `${average} h` : '–'}
          </ThemedText>
          <ThemedText variant="bold" size={9} style={{ color: c.inverseText, letterSpacing: 1 }}>
            MEDIA
          </ThemedText>
        </View>
        {(
          [
            [0.25, times.main, 'historia principal'],
            [0.5, times.extra, 'historia + secundarias'],
            [1, times.full, 'completándolo todo'],
          ] as [number, number | null, string][]
        ).map(([fraction, hours, label]) => (
          <View key={label} style={styles.hltbRow}>
            <PieIcon fraction={fraction} size={22} />
            <ThemedText size={15}>
              <ThemedText variant="bold" size={15}>
                {hours != null ? `${formatScore(hours)} h ` : '– h '}
              </ThemedText>
              {label}
            </ThemedText>
          </View>
        ))}
        {userGame?.hoursPlayed ? (
          <ThemedText variant="muted" size={12} style={{ marginTop: 6 }}>
            Llevas {userGame.hoursPlayed} h jugadas.
          </ThemedText>
        ) : null}
      </Card>

      {game && game.source !== 'custom' && !hideAchievements ? <AchievementsCard game={game} /> : null}

      {game && game.source !== 'custom' ? <PriceCard game={game} /> : null}

      {userGame ? (
        <Card>
          <ThemedText variant="display" size={19} style={{ marginBottom: 12 }}>
            Tu partida
          </ThemedText>
          <View style={styles.partRow}>
            <StatusIcon status={userGame.status} size={34} />
            <View style={{ flex: 1 }}>
              <ThemedText variant="bold" size={15}>
                {STATUS_META[userGame.status].label}
              </ThemedText>
              <ThemedText variant="muted" size={10} style={{ letterSpacing: 0.8 }}>
                {STATUS_META[userGame.status].caption}
              </ThemedText>
              {(userGame.status === 'playing' || userGame.status === 'paused') &&
              daysSince(userGame.startedAt) != null ? (
                <ThemedText variant="bold" size={13} style={{ marginTop: 4 }}>
                  {daysSince(userGame.startedAt) === 0
                    ? 'Lo has empezado hoy'
                    : `Llevas ${daysSince(userGame.startedAt)} ${daysSince(userGame.startedAt) === 1 ? 'día' : 'días'} con él`}
                </ThemedText>
              ) : null}
              {eta ? (
                <ThemedText size={13} style={{ marginTop: 4, color: c.accent }}>
                  {eta.assumed
                    ? `Jugando 1 h al día, lo terminas el ${longDate(eta.date)}`
                    : `A tu ritmo (${eta.perWeek} h/semana) lo terminas el ${longDate(eta.date)}`}
                </ThemedText>
              ) : null}
            </View>
          </View>
          <View style={styles.partGrid}>
            <Part label="Plataforma" value={userGame.platform} />
            <Part label="Horas jugadas" value={userGame.hoursPlayed != null ? `${userGame.hoursPlayed} h` : null} />
            <Part label="Favorito" value={userGame.favorite ? '★' : '–'} />
          </View>
          <View style={{ marginTop: 14 }}>{game ? <PlayDetails game={game} /> : null}</View>
          <Pressable onPress={() => router.push(`/game/${encodeURIComponent(gameId)}/edit`)} style={{ marginTop: 12 }}>
            <ThemedText variant="bold" size={12} style={{ textDecorationLine: 'underline' }}>
              EDITAR DETALLES
            </ThemedText>
          </Pressable>
        </Card>
      ) : null}

      <Card>
        <ThemedText variant="display" size={19} style={{ marginBottom: 14 }}>
          Tu reseña
        </ThemedText>
        {userGame?.rating ? (
          <View style={{ gap: 12 }}>
            <View style={styles.partRow}>
              <ScoreHex score={userGame.rating} size={46} />
              <ThemedText variant="display" size={22}>
                {scoreLabel(userGame.rating)}
              </ThemedText>
            </View>
            {userGame.review ? (
              userGame.spoilers && !showSpoilers ? (
                <Pressable
                  onPress={() => setShowSpoilers(true)}
                  style={[styles.spoiler, { backgroundColor: c.soft, borderRadius: c.radius }]}
                >
                  <Ionicons name="eye-off-outline" size={18} color={c.muted} />
                  <ThemedText variant="muted" size={13}>
                    Contiene spoilers. Toca para leerla.
                  </ThemedText>
                </Pressable>
              ) : (
                <ThemedText size={15} style={{ lineHeight: 22 }}>
                  {userGame.review}
                </ThemedText>
              )
            ) : null}
            {userGame.liked.length || userGame.disliked.length ? (
              <View style={styles.tags}>
                {userGame.liked.map((t) => (
                  <Tag key={`l${t}`} label={t} up />
                ))}
                {userGame.disliked.map((t) => (
                  <Tag key={`d${t}`} label={t} />
                ))}
              </View>
            ) : null}
            <DarkButton
              label="Editar reseña"
              onPress={() => router.push(`/game/${encodeURIComponent(gameId)}/review`)}
              style={{ alignSelf: 'flex-start' }}
            />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <ThemedText variant="muted" size={14}>
              Aún no lo has valorado. Ponle nota, di qué te gustó y escribe tu reseña.
            </ThemedText>
            <DarkButton
              label="Valorar este juego"
              onPress={() => router.push(`/game/${encodeURIComponent(gameId)}/review`)}
              style={{ alignSelf: 'flex-start' }}
            />
          </View>
        )}
      </Card>

      {video || shots.length ? (
        <Card>
          <ThemedText variant="display" size={19} style={{ marginBottom: 14 }}>
            Imágenes y capturas
          </ThemedText>
          {video ? (
            <Pressable
              onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${video}`)}
              style={[styles.video, { borderRadius: c.radius }]}
            >
              <Image
                source={`https://img.youtube.com/vi/${video}/hqdefault.jpg`}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
              <View style={styles.play}>
                <Ionicons name="play" size={30} color="#fff" style={{ marginLeft: 4 }} />
              </View>
            </Pressable>
          ) : null}
          <View style={styles.shots}>
            {shots.slice(0, 4).map((url, i) => (
              <Pressable
                key={url}
                onPress={() => setGallery(i)}
                style={{
                  width: (innerW - 10) / 2,
                  height: ((innerW - 10) / 2) * 0.75,
                  borderRadius: c.radius,
                  overflow: 'hidden',
                }}
              >
                <Image source={url} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                {i === 3 && shots.length > 4 ? (
                  <View style={styles.moreShots}>
                    <ThemedText variant="bold" size={13} style={{ color: '#fff', letterSpacing: 1 }}>
                      {shots.length} IMÁGENES
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      <Card>
        <ThemedText variant="display" size={19} style={{ marginBottom: 12 }}>
          Resumen
        </ThemedText>
        {summary ? (
          <ThemedText
            size={14}
            style={{ lineHeight: 22 }}
            numberOfLines={moreText ? undefined : 7}
            onPress={() => setMoreText((m) => !m)}
          >
            {summary}
          </ThemedText>
        ) : (
          <ThemedText variant="muted" size={14}>
            {loading ? 'Cargando…' : 'Sin descripción.'}
          </ThemedText>
        )}
        {game.version || game.note ? (
          <View style={styles.field}>
            <ThemedText variant="bold" size={14}>
              Versión recomendada
            </ThemedText>
            {game.version ? <ThemedText size={14}>{game.version}</ThemedText> : null}
            {game.note ? (
              <ThemedText variant="muted" size={13}>
                {game.note}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
        {fields.map(([label, value]) => {
          const text = Array.isArray(value) ? value.join(', ') : value;
          if (!text) return null;
          return (
            <View key={label} style={styles.field}>
              <ThemedText variant="bold" size={14}>
                {label}
              </ThemedText>
              <ThemedText size={14} style={{ textDecorationLine: 'underline' }}>
                {text}
              </ThemedText>
            </View>
          );
        })}
        {details ? (
          <ThemedText
            variant="muted"
            size={11}
            style={{ marginTop: 18, textDecorationLine: 'underline' }}
            onPress={() => details.url && Linking.openURL(details.url)}
          >
            Datos de {details.source === 'rawg' ? 'RAWG (rawg.io)' : 'IGDB (igdb.com)'}
          </ThemedText>
        ) : null}
      </Card>

      <Gallery shots={shots} index={gallery} onClose={() => setGallery(null)} />
    </View>
  );
}

function Part({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.part}>
      <ThemedText variant="muted" size={11}>
        {label}
      </ThemedText>
      <ThemedText size={14}>{value || '–'}</ThemedText>
    </View>
  );
}

function Tag({ label, up }: { label: string; up?: boolean }) {
  const c = useIgnColors();
  return (
    <View style={[styles.tag, { backgroundColor: c.soft }]}>
      <Ionicons name={up ? 'thumbs-up' : 'thumbs-down'} size={12} color={up ? '#6aa834' : '#e5484d'} />
      <ThemedText size={12}>{label}</ThemedText>
    </View>
  );
}

function Gallery({ shots, index, onClose }: { shots: string[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  return (
    <Modal visible={index != null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.galleryBg}>
        <ScrollView
          horizontal
          pagingEnabled
          contentOffset={{ x: (index ?? 0) * width, y: 0 }}
          showsHorizontalScrollIndicator={false}
        >
          {shots.map((url) => (
            <View key={url} style={{ width, height, justifyContent: 'center' }}>
              <Image
                source={url.replace('t_screenshot_big', 't_1080p')}
                style={{ width, height: width * 0.5625 }}
                contentFit="contain"
              />
            </View>
          ))}
        </ScrollView>
        <Pressable onPress={onClose} style={styles.galleryClose} hitSlop={12}>
          <Ionicons name="close" size={30} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

// ---------- Listas ----------

function ListsTab({ gameId, onOrganize }: { gameId: string; onOrganize: () => void }) {
  const c = useIgnColors();
  const items = useStore((s) => s.items);
  const mine = useMyLists();
  const community = useCommunityLists();
  const preview = useListPreview();
  const count = useListCount();
  const containing = useMemo(
    () =>
      new Set(
        Object.values(items)
          .filter((i) => i.gameId === gameId)
          .map((i) => i.listId),
      ),
    [items, gameId],
  );
  const myIn = mine.filter((l) => containing.has(l.id));
  const others = [...OFFICIAL_LISTS, ...community].filter((l) => containing.has(l.id));

  const row = (list: (typeof mine)[number]) => (
    <Pressable key={list.id} onPress={() => router.push(`/list/${list.id}`)} style={styles.listRow}>
      <Mosaic list={list} games={preview(list.id)} size={52} radius={8} />
      <View style={{ flex: 1 }}>
        <ThemedText size={15} numberOfLines={1}>
          {list.name}
        </ThemedText>
        <ThemedText variant="muted" size={12}>
          {count(list.id)} juegos
        </ThemedText>
      </View>
      <Ionicons name={list.visibility === 'private' ? 'lock-closed' : 'globe-outline'} size={15} color={c.muted} />
    </Pressable>
  );

  return (
    <View style={{ gap: 18 }}>
      <Card>
        <ThemedText variant="display" size={19} style={{ marginBottom: 8 }}>
          En tus listas
        </ThemedText>
        {myIn.length ? (
          myIn.map(row)
        ) : (
          <ThemedText variant="muted">Todavía no está en ninguna de tus listas.</ThemedText>
        )}
        <DarkButton
          label="Organizar en listas"
          icon="add-circle-outline"
          onPress={onOrganize}
          style={{ marginTop: 12 }}
        />
      </Card>
      {others.length ? (
        <Card>
          <ThemedText variant="display" size={19} style={{ marginBottom: 8 }}>
            Listas públicas con este juego
          </ThemedText>
          {others.map(row)}
        </Card>
      ) : null}
    </View>
  );
}

// ---------- Reseñas ----------

function ReviewsTab({ gameId }: { gameId: string }) {
  const c = useIgnColors();
  const profileId = useStore((s) => s.currentProfileId);
  const profiles = useStore((s) => s.profiles);
  const userGames = useStore((s) => s.userGames);
  const reviews = Object.values(userGames)
    .filter(
      (u) => u.gameId === gameId && (u.rating != null || u.review) && (u.profileId === profileId || !u.reviewPrivate),
    )
    .sort((a, b) =>
      a.profileId === profileId ? -1 : b.profileId === profileId ? 1 : b.updatedAt.localeCompare(a.updatedAt),
    );
  const mineDone = reviews.some((r) => r.profileId === profileId);

  return (
    <View style={{ gap: 18 }}>
      {!mineDone ? (
        <DarkButton
          label="Escribir una reseña"
          icon="create-outline"
          onPress={() => router.push(`/game/${encodeURIComponent(gameId)}/review`)}
        />
      ) : null}
      {reviews.map((r) => {
        const p = profiles[r.profileId];
        return (
          <Card key={r.id} style={{ gap: 12 }}>
            <View style={styles.partRow}>
              <Avatar name={p?.displayName ?? '?'} color={p?.avatarColor ?? '#888'} uri={p?.photo} size={36} />
              <View style={{ flex: 1 }}>
                <ThemedText variant="bold" size={15}>
                  {p?.displayName ?? 'Jugador'}
                  {r.profileId === profileId ? ' (tú)' : ''}
                </ThemedText>
                <ThemedText variant="muted" size={11}>
                  {[
                    r.platform,
                    STATUS_META[r.status].short,
                    r.recommend === true ? 'Lo recomienda' : r.recommend === false ? 'No lo recomienda' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </View>
              {r.rating != null ? <ScoreSquare score={r.rating} size={40} /> : null}
            </View>
            {r.review ? (
              <ThemedText size={14} style={{ lineHeight: 21 }}>
                {r.spoilers ? `⚠️ Spoilers · ${r.review}` : r.review}
              </ThemedText>
            ) : null}
            {r.profileId === profileId ? (
              <Pressable onPress={() => router.push(`/game/${encodeURIComponent(gameId)}/review`)}>
                <ThemedText variant="bold" size={12} style={{ textDecorationLine: 'underline' }}>
                  EDITAR {r.reviewPrivate ? '· SOLO LA VES TÚ' : ''}
                </ThemedText>
              </Pressable>
            ) : null}
          </Card>
        );
      })}
      {reviews.length === 0 ? (
        <ThemedText variant="muted" size={14} style={{ textAlign: 'center', color: c.muted }}>
          Nadie ha reseñado este juego todavía.
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 16,
    height: 40,
    alignSelf: 'flex-start',
  },
  coverWrap: {
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 10,
  },
  coverBadge: { position: 'absolute', right: 8, bottom: 8 },
  holoHint: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 24,
  },
  title: { textAlign: 'center', flexShrink: 1 },
  center: { textAlign: 'center', marginTop: 6 },
  platforms: { alignItems: 'center', marginTop: 10 },
  block: { paddingHorizontal: 20, marginTop: 18, gap: 14 },
  scores: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 6 },
  scoreCol: { flex: 1, alignItems: 'center', gap: 8 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabs: { flexDirection: 'row', marginTop: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBody: { padding: 20 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  bigCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  hltbRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  partRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  partGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, rowGap: 12 },
  part: { width: '50%', gap: 2 },
  spoiler: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  video: { height: 190, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  play: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#e62117',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shots: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moreShots: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { marginTop: 16, gap: 3 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  galleryBg: { flex: 1, backgroundColor: '#000' },
  galleryClose: { position: 'absolute', top: 50, right: 20 },
});
