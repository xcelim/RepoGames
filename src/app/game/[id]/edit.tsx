import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { RatingPicker, StatusPicker } from '@/components/games';
import { ScreenHeader } from '@/components/lists';
import { Section } from '@/components/Section';
import { ThemedText } from '@/components/ThemedText';
import { Chip, TextField } from '@/components/ui';
import { LIKE_TAGS, PLATFORMS } from '@/data/meta';
import { useGame } from '@/hooks/useLists';
import { useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';
import type { PlayStatus } from '@/types';
import { today } from '@/utils/id';
import { userGameKey } from '@/utils/library';
import { goBack } from '@/utils/nav';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const num = (text: string): number | null => {
  const value = parseFloat(text.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
};

function platformOptions(platforms: string): string[] {
  const own = platforms
    .split(/[/,·]/)
    .map((p) => p.trim())
    .filter(Boolean);
  return [...new Set([...own, ...PLATFORMS])];
}

// Editar tu estado, nota, plataforma y reseña de un juego (y sus datos, si lo creaste tú).
export default function EditGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = decodeURIComponent(id ?? '');
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  const game = useGame(gameId);
  const profileId = useStore((s) => s.currentProfileId);
  const existing = useStore((s) =>
    s.currentProfileId ? s.userGames[userGameKey(s.currentProfileId, gameId)] : undefined,
  );
  const setStatusAction = useStore((s) => s.setStatus);
  const updateUserGame = useStore((s) => s.updateUserGame);
  const removeFromLibrary = useStore((s) => s.removeFromLibrary);
  const upsertGame = useStore((s) => s.upsertGame);

  const [status, setStatus] = useState<PlayStatus | null>(existing?.status ?? null);
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [platform, setPlatform] = useState<string | null>(existing?.platform ?? null);
  const [otherPlatform, setOtherPlatform] = useState('');
  const [hours, setHours] = useState(existing?.hoursPlayed != null ? String(existing.hoursPlayed) : '');
  const [startedAt, setStartedAt] = useState(existing?.startedAt ?? '');
  const [finishedAt, setFinishedAt] = useState(existing?.finishedAt ?? '');
  const [owned, setOwned] = useState(existing?.owned ?? false);
  const [favorite, setFavorite] = useState(existing?.favorite ?? false);
  const [liked, setLiked] = useState<string[]>(existing?.liked ?? []);
  const [disliked, setDisliked] = useState<string[]>(existing?.disliked ?? []);
  const [review, setReview] = useState(existing?.review ?? '');

  // Datos del juego (solo los creados a mano)
  const editableGame = game?.source === 'custom' && game.createdBy === profileId;
  const [info, setInfo] = useState({
    title: game?.title ?? '',
    year: game?.year ? String(game.year) : '',
    platforms: game?.platforms ?? '',
    coverUrl: game?.coverUrl ?? '',
    main: game?.main != null ? String(game.main) : '',
    extra: game?.extra != null ? String(game.extra) : '',
    full: game?.full != null ? String(game.full) : '',
    synopsis: game?.synopsis ?? '',
  });

  if (!game) return null;

  const toggle = (list: string[], set: (v: string[]) => void, tag: string) =>
    set(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);

  const choosePlatform = (p: string) => setPlatform(platform === p ? null : p);

  const save = () => {
    for (const [label, value] of [
      ['Empezado', startedAt],
      ['Terminado', finishedAt],
    ] as const) {
      if (value && !DATE_RE.test(value.trim())) {
        Alert.alert('Fecha no válida', `${label}: escríbela como AAAA-MM-DD (por ejemplo 2026-03-15).`);
        return;
      }
    }
    if (editableGame) {
      if (!info.title.trim()) {
        Alert.alert('Falta el título');
        return;
      }
      upsertGame({
        ...game,
        title: info.title.trim(),
        year: num(info.year),
        platforms: info.platforms.trim(),
        coverUrl: info.coverUrl.trim() || null,
        main: num(info.main),
        extra: num(info.extra),
        full: num(info.full),
        synopsis: info.synopsis.trim() || null,
        igdbQuery: info.title.trim(),
      });
    }
    const hasData =
      status || rating || platform || otherPlatform.trim() || hours || review.trim() || liked.length || disliked.length;
    if (hasData) {
      const finalStatus: PlayStatus = status ?? (rating ? 'beaten' : 'backlog');
      setStatusAction(game.id, finalStatus);
      updateUserGame(game.id, {
        rating,
        platform: otherPlatform.trim() || platform,
        hoursPlayed: num(hours),
        startedAt: startedAt.trim() || null,
        finishedAt: finishedAt.trim() || null,
        owned,
        favorite,
        liked,
        disliked,
        review: review.trim(),
      });
    }
    goBack();
  };

  const remove = () =>
    Alert.alert('Quitar de tu biblioteca', 'Se borrarán su estado, nota y reseña.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => {
          removeFromLibrary(game.id);
          goBack();
        },
      },
    ]);

  const options = platformOptions(game.platforms);

  return (
    <View style={styles.flex}>
      <ScreenHeader
        close
        title={game.title}
        right={
          <Pressable onPress={save} hitSlop={10} style={styles.saveTop}>
            <ThemedText variant="bold" style={{ color: skin.colors.accent }}>
              Guardar
            </ThemedText>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Section title="Estado">
          <StatusPicker
            value={status}
            onChange={(s) => {
              setStatus(s);
              if (s === 'playing' && !startedAt) setStartedAt(today());
              if ((s === 'beaten' || s === 'completed') && !finishedAt) setFinishedAt(today());
            }}
          />
        </Section>

        <Section title={`Tu nota${rating ? ` · ${rating}/10` : ''}`}>
          <RatingPicker value={rating} onChange={setRating} />
        </Section>

        <Section title={`Plataforma${platform ? ` · ${platform}` : ''}`}>
          <View style={styles.wrap}>
            {options.slice(0, 18).map((p) => (
              <Chip key={p} label={p} selected={platform === p} onPress={() => choosePlatform(p)} />
            ))}
          </View>
          <TextField value={otherPlatform} onChangeText={setOtherPlatform} placeholder="Otra plataforma…" />
        </Section>

        <Section title="Tu partida">
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField label="Horas jugadas" keyboardType="numeric" value={hours} onChangeText={setHours} />
            </View>
            <View style={styles.flex}>
              <TextField label="Empezado" placeholder="AAAA-MM-DD" value={startedAt} onChangeText={setStartedAt} />
            </View>
            <View style={styles.flex}>
              <TextField label="Terminado" placeholder="AAAA-MM-DD" value={finishedAt} onChangeText={setFinishedAt} />
            </View>
          </View>
          <View style={styles.switchRow}>
            <Ionicons name="cube-outline" size={18} color={skin.colors.accent} />
            <ThemedText style={styles.flex}>Lo tengo</ThemedText>
            <Switch
              value={owned}
              onValueChange={setOwned}
              trackColor={{ true: skin.colors.accent, false: skin.colors.line }}
              thumbColor={skin.colors.panel}
            />
          </View>
          <View style={styles.switchRow}>
            <Ionicons name="heart" size={18} color="#e66cc4" />
            <ThemedText style={styles.flex}>Favorito</ThemedText>
            <Switch
              value={favorite}
              onValueChange={setFavorite}
              trackColor={{ true: '#e66cc4', false: skin.colors.line }}
              thumbColor={skin.colors.panel}
            />
          </View>
        </Section>

        <Section title="Reseña">
          <ThemedText variant="bold" size={13} style={{ color: '#3dbb6b' }}>
            Lo mejor
          </ThemedText>
          <View style={styles.wrap}>
            {LIKE_TAGS.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                color="#3dbb6b"
                selected={liked.includes(tag)}
                onPress={() => toggle(liked, setLiked, tag)}
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
                selected={disliked.includes(tag)}
                onPress={() => toggle(disliked, setDisliked, tag)}
              />
            ))}
          </View>
          <TextField multiline value={review} onChangeText={setReview} placeholder="¿Qué te ha parecido?" />
        </Section>

        {editableGame ? (
          <Section title="Datos del juego">
            <TextField label="Título" value={info.title} onChangeText={(title) => setInfo((f) => ({ ...f, title }))} />
            <View style={styles.row}>
              <View style={styles.flex}>
                <TextField
                  label="Año"
                  keyboardType="numeric"
                  value={info.year}
                  onChangeText={(year) => setInfo((f) => ({ ...f, year }))}
                />
              </View>
              <View style={styles.flex2}>
                <TextField
                  label="Plataformas"
                  value={info.platforms}
                  onChangeText={(platforms) => setInfo((f) => ({ ...f, platforms }))}
                />
              </View>
            </View>
            <TextField
              label="Portada (enlace a una imagen)"
              value={info.coverUrl}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://…"
              onChangeText={(coverUrl) => setInfo((f) => ({ ...f, coverUrl }))}
            />
            <View style={styles.row}>
              {(['main', 'extra', 'full'] as const).map((key) => (
                <View key={key} style={styles.flex}>
                  <TextField
                    label={key === 'main' ? 'Horas historia' : key === 'extra' ? '+ Secundarias' : '100 %'}
                    keyboardType="numeric"
                    value={info[key]}
                    onChangeText={(value) => setInfo((f) => ({ ...f, [key]: value }))}
                  />
                </View>
              ))}
            </View>
            <TextField
              label="Sinopsis"
              multiline
              value={info.synopsis}
              onChangeText={(synopsis) => setInfo((f) => ({ ...f, synopsis }))}
            />
          </Section>
        ) : null}

        <Button label="Guardar" onPress={save} />
        {existing ? <Button kind="ghost" label="Quitar de mi biblioteca" onPress={remove} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 2 },
  content: { paddingHorizontal: 16, gap: 24 },
  saveTop: { paddingHorizontal: 10, paddingVertical: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
