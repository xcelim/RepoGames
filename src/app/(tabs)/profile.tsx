import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { PlatinumBadge } from '@/components/achievements';
import { Collapsible } from '@/components/Collapsible';
import { AvatarFrame } from '@/components/AvatarFrame';
import {
  Card,
  CoverTile,
  Donut,
  glass,
  HeaderIcon,
  IgnScreen,
  ProgressBar,
  StatusIcon,
  useIgnColors,
} from '@/components/ign';
import { LevelBadge } from '@/components/LevelBadge';
import { RankBadge } from '@/components/RankBadge';
import { ShowcaseView } from '@/components/showcases';
import { useLevel } from '@/hooks/useLevel';
import { useUnreadNotifications } from '@/hooks/useNotifications';
import { funFact } from '@/utils/fun';
import { levelColor } from '@/utils/level';
import { Shine } from '@/components/Shine';
import { GameCover } from '@/components/games';
import { usePlatinums } from '@/hooks/usePlatinums';
import { OfflineDownloadCard } from '@/components/cloudPanel';
import { ThemedText } from '@/components/ThemedText';
import { Avatar, MenuRow } from '@/components/ui';
import { FINISHED, scoreColor, STATUS_META, STATUS_ORDER } from '@/data/meta';
import { useMyLists } from '@/hooks/useLists';
import { useCurrentProfile, useStore } from '@/store/useStore';
import { TROPHIES } from '@/utils/trophies';
import { useSkin } from '@/theme/useSkin';
import { findGame, formatHours } from '@/utils/library';
import { HScroll } from '@/components/HScroll';

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const skin = useSkin();
  return (
    <View style={styles.barRow}>
      <ThemedText size={12} style={styles.barLabel} numberOfLines={1}>
        {label}
      </ThemedText>
      <View style={[styles.track, { backgroundColor: skin.colors.panel2 }]}>
        <View style={[styles.fill, { width: `${max > 0 ? (value / max) * 100 : 0}%`, backgroundColor: color }]} />
      </View>
      <ThemedText variant="bold" size={12} style={styles.barValue}>
        {value}
      </ThemedText>
    </View>
  );
}

export default function ProfileScreen() {
  const skin = useSkin();
  const { width } = useWindowDimensions();
  const profile = useCurrentProfile();
  const userGames = useStore((s) => s.userGames);
  const games = useStore((s) => s.games);
  const mode = useStore((s) => s.durationMode);
  const myLists = useMyLists();
  const lv = useLevel();
  const unreadNotes = useUnreadNotifications();
  const [factShift, setFactShift] = useState(0);

  const data = useMemo(() => {
    const mine = Object.values(userGames).filter((g) => g.profileId === profile?.id);
    const byStatus: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};
    const ratings = Array<number>(10).fill(0);
    let ratingSum = 0;
    let rated = 0;
    let hoursPlayed = 0;
    let hoursLeft = 0;
    let estimated = false;
    for (const ug of mine) {
      byStatus[ug.status] = (byStatus[ug.status] ?? 0) + 1;
      if (ug.platform) byPlatform[ug.platform] = (byPlatform[ug.platform] ?? 0) + 1;
      if (ug.rating) {
        ratings[ug.rating - 1] += 1;
        ratingSum += ug.rating;
        rated += 1;
      }
      if (ug.hoursPlayed != null) hoursPlayed += ug.hoursPlayed;
      else if (ug.status === 'beaten' || ug.status === 'completed') {
        // Sin horas apuntadas: usamos lo que dura el juego (HowLongToBeat de IGDB).
        const g = findGame(games, ug.gameId);
        const h = (ug.status === 'completed' ? (g?.full ?? g?.[mode]) : g?.[mode]) ?? 0;
        if (h) estimated = true;
        hoursPlayed += h;
      }
      if (['backlog', 'playing', 'paused'].includes(ug.status)) {
        hoursLeft += findGame(games, ug.gameId)?.[mode] ?? 0;
      }
    }
    const topRated = mine
      .filter((ug) => ug.rating)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 3)
      .map((ug) => ({ ug, game: findGame(games, ug.gameId) }));
    return {
      total: mine.length,
      finished: mine.filter((g) => FINISHED.includes(g.status)).length,
      byStatus,
      platforms: Object.entries(byPlatform)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
      ratings,
      average: rated ? Math.round((ratingSum / rated) * 10) / 10 : null,
      hoursPlayed,
      hoursLeft,
      estimated,
      topRated,
    };
  }, [userGames, games, profile?.id, mode]);

  if (!profile) return null;
  const fact = funFact(data.hoursPlayed, factShift);
  const maxRating = Math.max(1, ...data.ratings);
  const maxPlatform = Math.max(1, ...data.platforms.map((p) => p[1]));
  const publicLists = myLists.filter((l) => l.visibility === 'public').length;

  const donutStatuses = STATUS_ORDER.filter((st) => (data.byStatus[st] ?? 0) > 0);

  return (
    <IgnScreen
      title="Perfil"
      right={
        <>
          <HeaderIcon icon="people-outline" label="Cuentas" onPress={() => router.push('/accounts')} />
          <HeaderIcon icon="settings-outline" label="Ajustes" onPress={() => router.push('/settings')} />
        </>
      }
    >
      <View style={styles.content}>
        <View style={styles.head}>
          <Pressable onPress={() => router.push('/profile-edit')}>
            <AvatarFrame frame={lv.frame} size={80}>
              <Avatar name={profile.displayName} color={profile.avatarColor} uri={profile.photo} size={80} />
            </AvatarFrame>
          </Pressable>
          <View style={styles.flex}>
            <ThemedText variant="display" size={24} numberOfLines={1}>
              {profile.displayName}
            </ThemedText>
            <ThemedText variant="muted">@{profile.username}</ThemedText>
            <ThemedText variant="muted" size={12}>
              {myLists.length} listas · {publicLists} públicas
            </ThemedText>
          </View>
          <Pressable onPress={() => router.push('/profile-edit')} hitSlop={10}>
            <Ionicons name="create-outline" size={20} color={skin.colors.muted} />
          </Pressable>
        </View>
        {profile.bio ? <ThemedText>{profile.bio}</ThemedText> : null}

        {/* Nivel (como en Steam) */}
        <Pressable onPress={() => router.push('/level')}>
          <Card style={styles.levelCard}>
            <LevelBadge level={lv.level} size={42} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.levelTop}>
                <ThemedText variant="display" size={17}>
                  Nivel {lv.level}
                </ThemedText>
                <ThemedText variant="muted" size={11}>
                  {lv.into.toLocaleString('es-ES')} / {lv.need.toLocaleString('es-ES')} XP
                </ThemedText>
              </View>
              <ProgressBar pct={(lv.into / lv.need) * 100} height={6} color={levelColor(lv.level)} />
            </View>
            <Ionicons name="chevron-forward" size={18} color={skin.colors.muted} />
          </Card>
        </Pressable>

        {/* Rangos competitivos */}
        {profile.ranks?.length ? (
          <Pressable onPress={() => router.push('/ranks')}>
            <HScroll contentContainerStyle={styles.ranks}>
              {profile.ranks.map((r) => (
                <RankBadge key={r.game} rank={r} size={46} />
              ))}
            </HScroll>
          </Pressable>
        ) : null}

        <Card style={styles.summary} padded={false}>
          <View style={styles.summaryRow}>
            <Stat value={String(data.total)} label="JUEGOS" />
            <Stat value={String(data.finished)} label="TERMINADOS" />
            <Stat value={data.average !== null ? String(data.average) : '–'} label="NOTA MEDIA" />
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: skin.colors.line }]} />
          <View style={styles.summaryRow}>
            <Stat value={formatHours(data.hoursPlayed)} label={data.estimated ? 'JUGADAS (APROX.)' : 'HORAS JUGADAS'} />
            <Stat value={formatHours(data.hoursLeft)} label="TE QUEDAN" />
          </View>
          {fact ? (
            <Pressable
              onPress={() => setFactShift((s) => s + 1)}
              style={[styles.fact, { borderTopColor: skin.colors.line }]}
            >
              <Ionicons name="bulb-outline" size={16} color={skin.colors.accent} />
              <ThemedText variant="muted" size={12} style={{ flex: 1 }}>
                {fact}
              </ThemedText>
            </Pressable>
          ) : null}
        </Card>

        <PlatinumsEntry />
        <TrophiesEntry />

        {/* Vitrinas */}
        {(profile.showcases ?? []).slice(0, lv.slots).map((sc, i) => (
          <ShowcaseView key={`${sc.type}-${i}`} showcase={sc} profile={profile} />
        ))}
        <ArcadeBanner />
        <View style={styles.quick}>
          <QuickButton
            icon="albums-outline"
            label={profile.showcases?.length ? 'Editar vitrinas' : 'Poner vitrinas'}
            onPress={() => router.push('/showcases')}
          />
          <QuickButton
            icon="medal-outline"
            label={profile.ranks?.length ? 'Mis rangos' : 'Añadir rangos'}
            onPress={() => router.push('/ranks')}
          />
          <QuickButton icon="id-card-outline" label="Mi tarjeta" onPress={() => router.push('/player-card')} />
        </View>
        <View style={styles.quick}>
          <QuickButton icon="sparkles-outline" label="Tu año" onPress={() => router.push('/wrapped')} />
          <QuickButton icon="logo-steam" label="Steam" onPress={() => router.push('/steam')} />
          <QuickButton
            icon="notifications-outline"
            label={unreadNotes ? `Avisos (${unreadNotes})` : 'Avisos'}
            onPress={() => router.push('/notifications')}
          />
        </View>

        <Collapsible
          id="library"
          icon="library-outline"
          title={`${data.total} en tu biblioteca`}
          summary={
            STATUS_ORDER.filter((st) => data.byStatus[st])
              .map((st) => `${data.byStatus[st]} ${STATUS_META[st].short.toLowerCase()}`)
              .join(' · ') || 'Aún vacía'
          }
          defaultOpen
        >
          <View style={styles.donut}>
            <Donut
              parts={donutStatuses.map((st) => ({ value: data.byStatus[st] ?? 0, color: STATUS_META[st].color }))}
              size={130}
              stroke={18}
            />
          </View>
          <View style={styles.legend}>
            {STATUS_ORDER.filter((st) => st !== 'library' || data.byStatus.library).map((st) => (
              <Pressable
                key={st}
                style={styles.legendItem}
                onPress={() => router.push(`/library/${st === 'completed' ? 'beaten' : st}`)}
              >
                <StatusIcon status={st} size={22} />
                <ThemedText variant="bold" size={14}>
                  {data.byStatus[st] ?? 0}
                </ThemedText>
                <ThemedText variant="muted" size={10} numberOfLines={1} style={{ flex: 1, letterSpacing: 0.6 }}>
                  {STATUS_META[st].short.toUpperCase()}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Collapsible>

        {data.topRated.length > 0 ? (
          <Collapsible
            id="top"
            icon="star-outline"
            title="Tus mejor valorados"
            summary={data.topRated
              .map(({ game }) => game?.title)
              .filter(Boolean)
              .join(' · ')}
          >
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {data.topRated.map(({ ug, game }, index) =>
                game ? (
                  <CoverTile
                    key={ug.id}
                    game={game}
                    width={(width - 40 - 36 - 24) / 3}
                    rank={index + 1}
                    subtitle={`${ug.rating}/10`}
                    onPress={() => router.push(`/game/${encodeURIComponent(game.id)}`)}
                  />
                ) : null,
              )}
            </View>
          </Collapsible>
        ) : null}

        <Collapsible
          id="ratings"
          icon="bar-chart-outline"
          title="Tus notas"
          summary={
            data.average !== null
              ? `Media ${data.average} · ${data.ratings.reduce((a, b) => a + b, 0)} juegos puntuados`
              : 'Aún no has puntuado ningún juego'
          }
        >
          <View style={styles.histogram}>
            {data.ratings.map((count, index) => (
              <View key={index} style={styles.histoCol}>
                <View style={styles.histoBarArea}>
                  <View
                    style={[
                      styles.histoBar,
                      {
                        height: `${(count / maxRating) * 100}%`,
                        backgroundColor: scoreColor(index + 1),
                        borderRadius: 3,
                      },
                    ]}
                  />
                </View>
                <ThemedText variant="muted" size={11}>
                  {index + 1}
                </ThemedText>
              </View>
            ))}
          </View>
        </Collapsible>

        {data.platforms.length > 0 ? (
          <Collapsible
            id="platforms"
            icon="game-controller-outline"
            title="Plataformas"
            summary={data.platforms
              .slice(0, 3)
              .map(([name, n]) => `${name} ${n}`)
              .join(' · ')}
          >
            <View style={{ gap: 8 }}>
              {data.platforms.map(([name, count]) => (
                <Bar key={name} label={name} value={count} max={maxPlatform} color={skin.colors.accent} />
              ))}
            </View>
          </Collapsible>
        ) : null}

        <OfflineDownloadCard />

        <Card>
          <MenuRow icon="create-outline" label="Editar perfil" onPress={() => router.push('/profile-edit')} />
          <MenuRow icon="people-outline" label="Cuenta y sincronización" onPress={() => router.push('/accounts')} />
          <MenuRow icon="settings-outline" label="Ajustes y estética" onPress={() => router.push('/settings')} />
          <MenuRow
            icon="eye-outline"
            label="Ver mi perfil público"
            onPress={() => router.push(`/user/${profile.id}`)}
          />
        </Card>
      </View>
    </IgnScreen>
  );
}

// Entrada a la sala de trofeos.
function TrophiesEntry() {
  const c = useIgnColors();
  const profile = useCurrentProfile();
  const got = Object.keys(profile?.trophies ?? {}).length;
  const total = TROPHIES.length + 1;
  return (
    <Pressable onPress={() => router.push('/trophies')} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={styles.platCard}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: '#f5c51833',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="trophy" size={24} color="#f5c518" />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText variant="display" size={18}>
            Trofeos
          </ThemedText>
          <ThemedText variant="muted" size={12}>
            {`${got} de ${total} trofeos de Saga Quest`}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.muted} />
      </Card>
    </Pressable>
  );
}

// Entrada a tus Platinos Saga Quest, con las portadas de los últimos.
function PlatinumsEntry() {
  const c = useIgnColors();
  const { list } = usePlatinums();
  return (
    <Pressable onPress={() => router.push('/platinums')} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={styles.platCard}>
        <PlatinumBadge size={44} />
        <View style={{ flex: 1 }}>
          <ThemedText variant="display" size={18}>
            Platinos
          </ThemedText>
          <ThemedText variant="muted" size={12}>
            {list.length
              ? `${list.length} ${list.length === 1 ? 'juego' : 'juegos'} con todos los logros`
              : 'Marca todos los logros de un juego para ganarlo'}
          </ThemedText>
        </View>
        <View style={styles.platCovers}>
          {list.slice(0, 3).map((p, i) => (
            <View key={p.game.id} style={{ marginLeft: i ? -14 : 0 }}>
              <Shine width={30} height={40} radius={4} border={1.5} badge={0}>
                <GameCover game={p.game} width={30} radius={0} plain />
              </Shine>
            </View>
          ))}
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.muted} />
      </Card>
    </Pressable>
  );
}

// Entrada a la sala de juegos (oráculo, duelos, tier lists, estantería, estadísticas...).
function ArcadeBanner() {
  return (
    <Pressable
      onPress={() => router.push('/arcade')}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <LinearGradient
        colors={['#7b2ff7', '#f107a3', '#ff8a00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.arcade}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <ThemedText variant="display" size={22} style={{ color: '#fff' }}>
            Sala de juegos
          </ThemedText>
          <ThemedText size={12} style={{ color: '#ffffffdd' }}>
            Mundo gamer, cromos, bingo, trofeos, oráculo, duelos y más
          </ThemedText>
        </View>
        <View style={styles.arcadeIcons}>
          {(['sparkles', 'flash', 'podium'] as const).map((n, i) => (
            <Ionicons key={n} name={n} size={22 - i * 2} color="#fff" style={{ opacity: 1 - i * 0.2 }} />
          ))}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function QuickButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const c = useIgnColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickBtn,
        { backgroundColor: glass(c.card), borderColor: c.line, borderRadius: c.radius, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={22} color={c.text} />
      <ThemedText
        variant="bold"
        size={11}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{ textAlign: 'center' }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText variant="bold" size={20}>
        {value}
      </ThemedText>
      <ThemedText variant="muted" size={10} style={{ letterSpacing: 0.8 }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  statsCard: { flexDirection: 'row', paddingVertical: 16 },
  summary: { paddingVertical: 6 },
  levelCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  levelTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  ranks: { gap: 4, paddingVertical: 2 },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  quick: { flexDirection: 'row', gap: 10 },
  arcade: { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  arcadeIcons: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryRow: { flexDirection: 'row', paddingVertical: 12 },
  summaryDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 18 },
  platCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  platCovers: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  donut: { alignItems: 'center', marginVertical: 18 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  legendItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tiles: { flexDirection: 'row', gap: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 84 },
  barValue: { width: 26, textAlign: 'right' },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%' },
  histogram: { flexDirection: 'row', gap: 4, height: 110 },
  histoCol: { flex: 1, alignItems: 'center', gap: 4 },
  histoBarArea: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  histoBar: { width: '100%', minHeight: 2 },
});
