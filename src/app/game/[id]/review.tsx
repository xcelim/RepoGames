import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DarkButton,
  LightButton,
  PlatformChips,
  ScoreSquare,
  scoreLabel,
  ToggleRow,
  useIgnColors,
} from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { LIKE_TAGS, platformBadge, PLATFORMS, scoreColor, STATUS_META } from '@/data/meta';
import { useGame } from '@/hooks/useLists';
import { useStore } from '@/store/useStore';
import { userGameKey } from '@/utils/library';

const STEPS = 5;
const MAX_TEXT = 2000;

// Asistente de reseña de IGN: nota → plataforma → qué te gustó → texto → resumen y publicar.
export default function ReviewWizard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = decodeURIComponent(id ?? '');
  const c = useIgnColors();
  const insets = useSafeAreaInsets();
  const game = useGame(gameId);
  const existing = useStore((s) =>
    s.currentProfileId ? s.userGames[userGameKey(s.currentProfileId, gameId)] : undefined,
  );
  const updateUserGame = useStore((s) => s.updateUserGame);
  const upsertGame = useStore((s) => s.upsertGame);

  const [step, setStep] = useState(0);
  const [posted, setPosted] = useState(false);
  const [draft, setDraft] = useState({
    rating: existing?.rating ?? null,
    recommend: existing?.recommend ?? true,
    platform: existing?.platform ?? null,
    liked: existing?.liked ?? [],
    disliked: existing?.disliked ?? [],
    review: existing?.review ?? '',
    spoilers: existing?.spoilers ?? false,
    reviewPrivate: existing?.reviewPrivate ?? false,
  });
  const patch = (p: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...p }));

  if (!game) return null;

  const exit = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const back = () => (step === 0 ? exit() : setStep(step - 1));
  const publish = () => {
    if (!useStore.getState().games[game.id]) upsertGame(game);
    updateUserGame(game.id, draft);
    setPosted(true);
  };

  if (posted) {
    const message = `He puesto un ${draft.rating ?? '–'}/10 a «${game.title}» en Saga Quest 🎮${draft.recommend ? ' ¡Lo recomiendo!' : ''}`;
    return (
      <View
        style={[styles.flex, { backgroundColor: c.bg, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}
      >
        <View style={styles.posted}>
          <Ionicons name="checkmark-circle" size={64} color="#6aa834" />
          <ThemedText variant="display" size={28} style={styles.question}>
            ¡Reseña guardada!
          </ThemedText>
          <View style={[styles.shareBox, { backgroundColor: c.card, borderColor: c.line, borderRadius: c.radius }]}>
            <ThemedText size={15}>{message}</ThemedText>
          </View>
        </View>
        <View style={styles.footer}>
          <DarkButton
            label="Compartir"
            icon="share-outline"
            onPress={() => Share.share({ message }).catch(() => undefined)}
          />
          <LightButton label="Hecho" onPress={exit} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top }}>
        <View style={styles.top}>
          <Pressable onPress={back} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <ThemedText variant="bold" size={12} numberOfLines={1} style={styles.topTitle}>
            {game.title.toUpperCase()}
          </ThemedText>
          <Pressable onPress={exit} hitSlop={10}>
            <Ionicons name="close" size={28} color={c.text} />
          </Pressable>
        </View>
        <View style={styles.progress}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <View key={i} style={[styles.progressSeg, { backgroundColor: i <= step ? c.text : c.line }]} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 ? <RatingStep rating={draft.rating} onChange={(rating) => patch({ rating })} /> : null}
        {step === 0 ? (
          <ToggleRow
            label="Recomiendo este juego"
            value={draft.recommend}
            onChange={(recommend) => patch({ recommend })}
          />
        ) : null}
        {step === 1 ? (
          <PlatformStep released={game.platforms} value={draft.platform} onChange={(platform) => patch({ platform })} />
        ) : null}
        {step === 2 ? (
          <TagsStep
            liked={draft.liked}
            disliked={draft.disliked}
            onChange={(liked, disliked) => patch({ liked, disliked })}
          />
        ) : null}
        {step === 3 ? (
          <TextStep
            text={draft.review}
            spoilers={draft.spoilers}
            onText={(review) => patch({ review })}
            onSpoilers={(spoilers) => patch({ spoilers })}
          />
        ) : null}
        {step === 4 ? (
          <SummaryStep
            draft={draft}
            status={existing?.status ?? 'library'}
            onPrivate={(reviewPrivate) => patch({ reviewPrivate })}
            onEdit={setStep}
          />
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step < STEPS - 1 ? (
          <>
            <DarkButton
              label="Siguiente"
              onPress={() => setStep(step + 1)}
              disabled={step === 0 && draft.rating == null}
            />
            <LightButton label="Revisar y publicar" onPress={() => setStep(STEPS - 1)} />
          </>
        ) : (
          <DarkButton label="Publicar" onPress={publish} disabled={draft.rating == null && !draft.review.trim()} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------- 1. Nota ----------

function RatingStep({ rating, onChange }: { rating: number | null; onChange: (r: number) => void }) {
  const c = useIgnColors();
  const [width, setWidth] = useState(1);
  const fromX = (x: number) => Math.max(1, Math.min(10, Math.ceil((x / width) * 10)));
  return (
    <View style={{ gap: 28 }}>
      <ThemedText variant="display" size={28} style={styles.question}>
        ¿Qué nota le pones a este juego?
      </ThemedText>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <View
          style={[styles.scoreBig, { backgroundColor: rating ? scoreColor(rating) : c.soft, borderRadius: c.radius }]}
        >
          <ThemedText variant="display" size={48} style={{ color: rating ? '#fff' : c.muted }}>
            {rating ?? '?'}
          </ThemedText>
        </View>
        <ThemedText variant="bold" size={18}>
          {rating ? scoreLabel(rating) : 'Desliza para puntuar'}
        </ThemedText>
      </View>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => onChange(fromX(e.nativeEvent.locationX))}
        onResponderMove={(e) => onChange(fromX(e.nativeEvent.locationX))}
        onResponderTerminationRequest={() => false}
        style={styles.slider}
      >
        <View pointerEvents="none" style={styles.sliderTrack}>
          {Array.from({ length: 10 }).map((_, i) => (
            <View
              key={i}
              style={[styles.sliderSeg, { backgroundColor: rating && i < rating ? scoreColor(rating) : c.line }]}
            />
          ))}
        </View>
        {rating ? (
          <View
            pointerEvents="none"
            style={[
              styles.knob,
              { left: ((rating - 0.5) / 10) * width - 22, backgroundColor: c.inverseBg, borderRadius: 10 },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.scaleRow}>
        <ThemedText variant="muted" size={11}>
          1 · {scoreLabel(1)}
        </ThemedText>
        <ThemedText variant="muted" size={11}>
          10 · {scoreLabel(10)}
        </ThemedText>
      </View>
    </View>
  );
}

// ---------- 2. Plataforma ----------

function PlatformStep({
  released,
  value,
  onChange,
}: {
  released: string;
  value: string | null;
  onChange: (p: string | null) => void;
}) {
  const c = useIgnColors();
  const [query, setQuery] = useState('');
  const known = released
    .split(/,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const all = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...new Set([...known, ...PLATFORMS])];
    return q ? list.filter((p) => p.toLowerCase().includes(q)) : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, released]);

  const option = (p: string) => {
    const on = value === p;
    const badge = platformBadge(p);
    return (
      <Pressable
        key={p}
        onPress={() => onChange(on ? null : p)}
        style={[
          styles.platOption,
          {
            borderColor: on ? c.text : c.line,
            borderWidth: on ? 2 : 1,
            backgroundColor: c.card,
            borderRadius: c.radius,
          },
        ]}
      >
        <View style={[styles.platIcon, { backgroundColor: badge.color }]}>
          <ThemedText variant="bold" size={11} style={{ color: '#fff' }}>
            {badge.label}
          </ThemedText>
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText size={15}>{p}</ThemedText>
          {known.includes(p) ? (
            <ThemedText variant="muted" size={10} style={{ letterSpacing: 0.8 }}>
              SALIÓ EN ESTA PLATAFORMA
            </ThemedText>
          ) : null}
        </View>
        <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={24} color={c.text} />
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 14 }}>
      <ThemedText variant="display" size={28} style={styles.question}>
        ¿En qué plataforma lo jugaste?
      </ThemedText>
      <View style={[styles.search, { borderColor: c.text, borderRadius: c.radius / 2 }]}>
        <Ionicons name="search" size={20} color={c.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar plataformas"
          placeholderTextColor={c.muted}
          style={[styles.searchInput, { color: c.text }]}
        />
      </View>
      {value ? (
        <>
          <ThemedText variant="bold" size={11} style={styles.overline}>
            PLATAFORMA ELEGIDA
          </ThemedText>
          {option(value)}
        </>
      ) : null}
      <ThemedText variant="bold" size={11} style={styles.overline}>
        {known.length ? 'PLATAFORMAS CONOCIDAS' : 'PLATAFORMAS'}
      </ThemedText>
      {all.map(option)}
    </View>
  );
}

// ---------- 3. Qué te gustó ----------

function TagsStep({
  liked,
  disliked,
  onChange,
}: {
  liked: string[];
  disliked: string[];
  onChange: (liked: string[], disliked: string[]) => void;
}) {
  const c = useIgnColors();
  const set = (tag: string, kind: 'up' | 'down') => {
    const up = liked.includes(tag);
    const down = disliked.includes(tag);
    const nextLiked = liked.filter((t) => t !== tag);
    const nextDisliked = disliked.filter((t) => t !== tag);
    if (kind === 'up' && !up) nextLiked.push(tag);
    if (kind === 'down' && !down) nextDisliked.push(tag);
    onChange(nextLiked, nextDisliked);
  };
  return (
    <View style={{ gap: 4 }}>
      <ThemedText variant="display" size={28} style={styles.question}>
        ¿Qué te gustó y qué no?
      </ThemedText>
      <ThemedText variant="muted" size={13} style={{ textAlign: 'center', marginBottom: 12 }}>
        Opcional. Marca solo lo que quieras destacar.
      </ThemedText>
      {LIKE_TAGS.map((tag) => {
        const up = liked.includes(tag);
        const down = disliked.includes(tag);
        return (
          <View key={tag} style={[styles.tagRow, { borderBottomColor: c.line }]}>
            <ThemedText size={15} style={{ flex: 1 }}>
              {tag}
            </ThemedText>
            <Pressable
              onPress={() => set(tag, 'down')}
              hitSlop={6}
              style={[styles.thumb, { backgroundColor: down ? '#e5484d' : c.soft }]}
            >
              <Ionicons name="thumbs-down" size={18} color={down ? '#fff' : c.muted} />
            </Pressable>
            <Pressable
              onPress={() => set(tag, 'up')}
              hitSlop={6}
              style={[styles.thumb, { backgroundColor: up ? '#6aa834' : c.soft }]}
            >
              <Ionicons name="thumbs-up" size={18} color={up ? '#fff' : c.muted} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

// ---------- 4. Texto ----------

function TextStep({
  text,
  spoilers,
  onText,
  onSpoilers,
}: {
  text: string;
  spoilers: boolean;
  onText: (t: string) => void;
  onSpoilers: (v: boolean) => void;
}) {
  const c = useIgnColors();
  return (
    <View style={{ gap: 14 }}>
      <ThemedText variant="display" size={28} style={styles.question}>
        ¿Qué deberían saber otros antes de jugarlo?
      </ThemedText>
      <View style={[styles.textArea, { borderColor: c.line, backgroundColor: c.card, borderRadius: c.radius }]}>
        <TextInput
          value={text}
          onChangeText={(t) => onText(t.slice(0, MAX_TEXT))}
          multiline
          placeholder="Escribe tu reseña…"
          placeholderTextColor={c.muted}
          style={[styles.textInput, { color: c.text }]}
          textAlignVertical="top"
        />
        <View style={styles.textFoot}>
          <ThemedText variant="muted" size={11}>
            {text.length}/{MAX_TEXT}
          </ThemedText>
          <Pressable onPress={() => onText('')} hitSlop={8}>
            <ThemedText variant="bold" size={11} style={{ letterSpacing: 1 }}>
              BORRAR
            </ThemedText>
          </Pressable>
        </View>
      </View>
      <ToggleRow label="Contiene spoilers" value={spoilers} onChange={onSpoilers} />
    </View>
  );
}

// ---------- 5. Resumen ----------

function SummaryStep({
  draft,
  status,
  onPrivate,
  onEdit,
}: {
  draft: {
    rating: number | null;
    recommend: boolean;
    platform: string | null;
    liked: string[];
    disliked: string[];
    review: string;
    spoilers: boolean;
    reviewPrivate: boolean;
  };
  status: keyof typeof STATUS_META;
  onPrivate: (v: boolean) => void;
  onEdit: (step: number) => void;
}) {
  const c = useIgnColors();
  const meta = STATUS_META[status];
  return (
    <View style={{ gap: 16 }}>
      <ThemedText variant="display" size={28} style={styles.question}>
        Tu reseña
      </ThemedText>
      <View style={[styles.summary, { backgroundColor: c.card, borderColor: c.line, borderRadius: c.radius + 4 }]}>
        {draft.reviewPrivate ? (
          <View style={[styles.privateBar, { backgroundColor: c.soft }]}>
            <Ionicons name="lock-closed" size={12} color={c.text} />
            <ThemedText variant="bold" size={10} style={{ letterSpacing: 1 }}>
              SOLO LA VES TÚ
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.summaryHead}>
          <Pressable onPress={() => onEdit(0)}>
            <ScoreSquare score={draft.rating} size={54} />
          </Pressable>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.pills}>
              {draft.recommend ? (
                <View style={[styles.pill, { backgroundColor: '#6aa834' }]}>
                  <Ionicons name="thumbs-up" size={11} color="#fff" />
                  <ThemedText variant="bold" size={11} style={{ color: '#fff' }}>
                    Recomendado
                  </ThemedText>
                </View>
              ) : null}
              <View style={[styles.pill, { backgroundColor: meta.color }]}>
                <ThemedText variant="bold" size={11} style={{ color: '#fff' }}>
                  {meta.short}
                </ThemedText>
              </View>
            </View>
            <Pressable onPress={() => onEdit(1)}>
              {draft.platform ? (
                <PlatformChips platforms={[draft.platform]} size="md" />
              ) : (
                <ThemedText variant="muted" size={12} style={{ textDecorationLine: 'underline' }}>
                  Añadir plataforma
                </ThemedText>
              )}
            </Pressable>
          </View>
        </View>
        <Pressable onPress={() => onEdit(3)}>
          <ThemedText size={14} style={{ lineHeight: 21 }} numberOfLines={8}>
            {draft.review.trim() ? draft.review : 'Sin texto (toca para escribir).'}
          </ThemedText>
        </Pressable>
        {draft.liked.length || draft.disliked.length ? (
          <Pressable onPress={() => onEdit(2)} style={styles.pills}>
            {draft.liked.map((t) => (
              <ThemedText key={`l${t}`} size={12} style={styles.tagText}>
                👍 {t}
              </ThemedText>
            ))}
            {draft.disliked.map((t) => (
              <ThemedText key={`d${t}`} size={12} style={styles.tagText}>
                👎 {t}
              </ThemedText>
            ))}
          </Pressable>
        ) : null}
        {draft.spoilers ? (
          <ThemedText variant="muted" size={12}>
            ⚠️ Marcada con spoilers
          </ThemedText>
        ) : null}
      </View>
      <ToggleRow
        label="Privada"
        caption="Si está activado, nadie más verá tu reseña."
        value={draft.reviewPrivate}
        onChange={onPrivate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 50, gap: 12 },
  topTitle: { flex: 1, textAlign: 'center', letterSpacing: 1 },
  progress: { flexDirection: 'row', gap: 4, paddingHorizontal: 0 },
  progressSeg: { flex: 1, height: 3 },
  body: { padding: 22, paddingBottom: 40, gap: 22 },
  question: { textAlign: 'center' },
  scoreBig: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  slider: { height: 56, justifyContent: 'center' },
  sliderTrack: { flexDirection: 'row', gap: 3, height: 16 },
  sliderSeg: { flex: 1, borderRadius: 4 },
  knob: { position: 'absolute', width: 44, height: 44, top: 6 },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -16 },
  footer: { paddingHorizontal: 22, gap: 10, paddingTop: 10 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  overline: { letterSpacing: 1.2, marginTop: 6 },
  platOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  platIcon: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  textArea: { borderWidth: 1, padding: 14 },
  textInput: { minHeight: 220, fontSize: 15 },
  textFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  summary: { borderWidth: 1, padding: 16, gap: 14, overflow: 'hidden' },
  privateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: -16,
    marginTop: -16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  summaryHead: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: { marginRight: 6 },
  posted: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 24 },
  shareBox: { borderWidth: 1, padding: 16, alignSelf: 'stretch' },
});
