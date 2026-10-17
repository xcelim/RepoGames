import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { DurationBar } from '@/components/DurationBar';
import {
  GameCover,
  RatingBadge,
  RatingPicker,
  StatusPicker,
  igdbQueryFor,
} from '@/components/games';
import { Section } from '@/components/Section';
import { ThemedText } from '@/components/ThemedText';
import { Chip, EmptyState, IconButton, Panel, TextField } from '@/components/ui';
import { LIKE_TAGS, PLATFORMS, STATUS_META } from '@/data/meta';
import { useGame } from '@/hooks/useLists';
import { useIgdb } from '@/hooks/useIgdb';
import { useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';
import type { PlayStatus, UserGame } from '@/types';
import { today } from '@/utils/id';
import { userGameKey } from '@/utils/library';

function platformSuggestions(platforms: string): string[] {
  const own = platforms
    .split(/[/,·]/)
    .map((p) => p.trim())
    .filter(Boolean);
  return [...new Set([...own, ...PLATFORMS])];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = decodeURIComponent(id ?? '');
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const game = useGame(gameId);
  const info = useIgdb(game ? igdbQueryFor(game) : '');

  const profileId = useStore((s) => s.currentProfileId);
  const userGame = useStore((s) =>
    s.currentProfileId ? s.userGames[userGameKey(s.currentProfileId, gameId)] : undefined,
  );
  const lists = useStore((s) => s.lists);
  const items = useStore((s) => s.items);
  const mode = useStore((s) => s.durationMode);
  const setStatus = useStore((s) => s.setStatus);
  const updateUserGame = useStore((s) => s.updateUserGame);
  const removeFromLibrary = useStore((s) => s.removeFromLibrary);

  const inLists = useMemo(() => {
    const ids = new Set(
      Object.values(items)
        .filter((item) => item.gameId === gameId)
        .map((item) => item.listId),
    );
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

  // Cualquier cambio guarda el juego en tu biblioteca si aún no estaba.
  const update = (patch: Partial<UserGame>, defaultStatus: PlayStatus = 'backlog') => {
    if (!userGame) setStatus(game.id, patch.rating ? 'beaten' : defaultStatus);
    updateUserGame(game.id, patch);
  };

  const toggleTag = (field: 'liked' | 'disliked', tag: string) => {
    const current = userGame?.[field] ?? [];
    update({ [field]: current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag] }, 'beaten');
  };

  const commitDate = (field: 'startedAt' | 'finishedAt', value: string) => {
    const text = value.trim();
    if (text === '') update({ [field]: null });
    else if (DATE_RE.test(text)) update({ [field]: text });
    else Alert.alert('Fecha no válida', 'Escríbela como AAAA-MM-DD, por ejemplo 2026-03-15.');
  };

  const openTrailer = () => {
    const search = encodeURIComponent(`${game.title} trailer`);
    Linking.openURL(
      info?.videoId
        ? `https://www.youtube.com/watch?v=${info.videoId}`
        : `https://www.youtube.com/results?search_query=${search}`,
    );
  };

  const confirmRemove = () =>
    Alert.alert('Quitar de tu biblioteca', 'Se borrarán su estado, nota y reseña.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => removeFromLibrary(game.id) },
    ]);

  const hasDurations = game.main !== null && game.full !== null;
  const synopsis = game.synopsis ?? info?.summary ?? null;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <View>
        <GameCover game={game} width={width} kind="wide" />
        <View style={[styles.heroShade, { backgroundColor: skin.colors.bg }]} />
        <View style={[styles.heroTop, { top: insets.top + 6 }]}>
          <IconButton icon="chevron-back" label="Volver" color="#fff" onPress={() => router.back()} />
          <View style={styles.flex} />
          <IconButton
            icon="add-circle-outline"
            label="Añadir a una lista"
            color="#fff"
            onPress={() => router.push(`/list/pick?gameId=${encodeURIComponent(game.id)}`)}
          />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <GameCover game={game} width={92} />
          <View style={styles.flex}>
            <ThemedText variant="display" size={26}>
              {game.title}
            </ThemedText>
            <ThemedText variant="muted" size={13}>
              {[game.year, game.platforms].filter(Boolean).join(' · ')}
            </ThemedText>
            {info?.rating ? (
              <ThemedText variant="muted" size={12}>
                Nota IGDB: {info.rating}/100
              </ThemedText>
            ) : null}
          </View>
          {userGame?.rating ? <RatingBadge rating={userGame.rating} size="lg" /> : null}
        </View>

        {game.version ? (
          <Panel style={styles.recommend}>
            <Ionicons name="sparkles" size={18} color={skin.colors.accent} />
            <View style={styles.flex}>
              <ThemedText variant="muted" size={11}>
                VERSIÓN RECOMENDADA
              </ThemedText>
              <ThemedText variant="bold">{game.version}</ThemedText>
            </View>
          </Panel>
        ) : null}

        <Section title={userGame ? `Estado · ${STATUS_META[userGame.status].label}` : 'Añadir a tu biblioteca'}>
          <StatusPicker value={userGame?.status ?? null} onChange={(s) => setStatus(game.id, s)} />
        </Section>

        <Section title={`Tu nota${userGame?.rating ? ` · ${userGame.rating}/10` : ''}`}>
          <RatingPicker value={userGame?.rating ?? null} onChange={(rating) => update({ rating })} />
        </Section>

        <Section title={`Plataforma en la que lo juegas${userGame?.platform ? ` · ${userGame.platform}` : ''}`}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {platformSuggestions(game.platforms).map((p) => (
              <Chip
                key={p}
                label={p}
                selected={userGame?.platform === p}
                onPress={() => update({ platform: userGame?.platform === p ? null : p })}
              />
            ))}
          </ScrollView>
          <TextField
            key={`platform-${userGame?.platform ?? ''}`}
            defaultValue={
              userGame?.platform && !platformSuggestions(game.platforms).includes(userGame.platform)
                ? userGame.platform
                : ''
            }
            placeholder="Otra plataforma…"
            onEndEditing={(e) => {
              const text = e.nativeEvent.text.trim();
              if (text) update({ platform: text });
            }}
          />
        </Section>

        <Section title="Tu partida">
          <View style={styles.twoCols}>
            <View style={styles.flex}>
              <TextField
                key={`hours-${userGame?.hoursPlayed ?? ''}`}
                label="Horas jugadas"
                keyboardType="numeric"
                defaultValue={userGame?.hoursPlayed != null ? String(userGame.hoursPlayed) : ''}
                placeholder={game[mode] ? `~${game[mode]}` : '0'}
                onEndEditing={(e) => {
                  const value = parseFloat(e.nativeEvent.text.replace(',', '.'));
                  update({ hoursPlayed: Number.isFinite(value) ? value : null });
                }}
              />
            </View>
            <View style={styles.flex}>
              <TextField
                key={`start-${userGame?.startedAt ?? ''}`}
                label="Empezado"
                defaultValue={userGame?.startedAt ?? ''}
                placeholder="AAAA-MM-DD"
                onEndEditing={(e) => commitDate('startedAt', e.nativeEvent.text)}
              />
            </View>
            <View style={styles.flex}>
              <TextField
                key={`end-${userGame?.finishedAt ?? ''}`}
                label="Terminado"
                defaultValue={userGame?.finishedAt ?? ''}
                placeholder="AAAA-MM-DD"
                onEndEditing={(e) => commitDate('finishedAt', e.nativeEvent.text)}
              />
            </View>
          </View>
          <View style={styles.chips}>
            <Chip label="Empezado hoy" icon="play" onPress={() => update({ startedAt: today() }, 'playing')} />
            <Chip label="Terminado hoy" icon="flag" onPress={() => update({ finishedAt: today() }, 'beaten')} />
          </View>
          <View style={styles.switchRow}>
            <Ionicons name="cube-outline" size={18} color={skin.colors.accent} />
            <ThemedText style={styles.flex}>Lo tengo</ThemedText>
            <Switch
              value={userGame?.owned ?? false}
              onValueChange={(owned) => update({ owned })}
              trackColor={{ true: skin.colors.accent, false: skin.colors.line }}
              thumbColor={skin.colors.panel}
            />
          </View>
          <View style={styles.switchRow}>
            <Ionicons name="heart" size={18} color="#e66cc4" />
            <ThemedText style={styles.flex}>Favorito</ThemedText>
            <Switch
              value={userGame?.favorite ?? false}
              onValueChange={(favorite) => update({ favorite })}
              trackColor={{ true: '#e66cc4', false: skin.colors.line }}
              thumbColor={skin.colors.panel}
            />
          </View>
        </Section>

        <Section title="Tu reseña">
          <ThemedText variant="bold" size={13} style={{ color: '#3dbb6b' }}>
            Lo mejor
          </ThemedText>
          <View style={styles.wrap}>
            {LIKE_TAGS.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                color="#3dbb6b"
                selected={userGame?.liked.includes(tag)}
                onPress={() => toggleTag('liked', tag)}
              />
            ))}
          </View>
          <ThemedText variant="bold" size={13} style={{ color: '#e5484d' }}>
            Lo peor
          </ThemedText>
          <View style={styles.wrap}>
            {LIKE_TAGS.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                color="#e5484d"
                selected={userGame?.disliked.includes(tag)}
                onPress={() => toggleTag('disliked', tag)}
              />
            ))}
          </View>
          <TextField
            key={`review-${userGame ? 'y' : 'n'}`}
            multiline
            defaultValue={userGame?.review ?? ''}
            placeholder="¿Qué te ha parecido? Se guarda al salir del campo."
            onEndEditing={(e) => {
              const review = e.nativeEvent.text;
              if (review !== (userGame?.review ?? '')) update({ review }, 'beaten');
            }}
          />
        </Section>

        <Section title="Tus listas">
          {inLists.length > 0 ? (
            <View style={styles.wrap}>
              {inLists.map((l) => (
                <Chip key={l.id} label={l.name} icon="folder" onPress={() => router.push(`/list/${l.id}`)} />
              ))}
            </View>
          ) : (
            <ThemedText variant="muted" size={13}>
              Todavía no está en ninguna de tus listas.
            </ThemedText>
          )}
          <Button
            kind="ghost"
            label="+ Añadir a una lista"
            onPress={() => router.push(`/list/pick?gameId=${encodeURIComponent(game.id)}`)}
          />
        </Section>

        {hasDurations ? (
          <Section title="Duración aproximada">
            <DurationBar label="Historia" hours={game.main ?? 0} max={game.full ?? 1} color={skin.colors.accent} />
            <DurationBar
              label="Historia + secundarias"
              hours={game.extra ?? 0}
              max={game.full ?? 1}
              color={skin.colors.text}
            />
            <DurationBar label="Al 100 %" hours={game.full ?? 0} max={game.full ?? 1} color={skin.colors.accent2} />
          </Section>
        ) : null}

        {synopsis ? (
          <Section title="Sinopsis">
            <ThemedText>{synopsis}</ThemedText>
          </Section>
        ) : null}

        {game.note ? (
          <ThemedText variant="muted" style={[styles.note, { borderColor: skin.colors.accent2 }]}>
            {game.note}
          </ThemedText>
        ) : null}

        {game.synopsis && info?.summary ? (
          <Section title="Resumen IGDB (inglés)">
            <ThemedText variant="muted" size={13}>
              {info.summary}
            </ThemedText>
          </Section>
        ) : null}

        <View style={styles.wrap}>
          <Button label="▶ Tráiler" onPress={openTrailer} />
          <Button
            kind="ghost"
            label="HowLongToBeat"
            onPress={() =>
              Linking.openURL(`https://howlongtobeat.com/?q=${encodeURIComponent(game.title)}`)
            }
          />
        </View>

        {userGame ? (
          <Pressable onPress={confirmRemove} style={styles.remove}>
            <Ionicons name="trash-outline" size={16} color="#e5484d" />
            <ThemedText variant="bold" size={13} style={{ color: '#e5484d' }}>
              Quitar de mi biblioteca
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 40, opacity: 0.6 },
  heroTop: { position: 'absolute', left: 8, right: 8, flexDirection: 'row' },
  content: { paddingHorizontal: 16, gap: 22, marginTop: -40 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  recommend: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  chips: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  twoCols: { flexDirection: 'row', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  note: { borderLeftWidth: 3, paddingLeft: 10 },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', padding: 8 },
});
