import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AvatarFrame } from '@/components/AvatarFrame';
import { Card, IgnScreen, ProgressBar, useIgnColors } from '@/components/ign';
import { LevelBadge } from '@/components/LevelBadge';
import { ThemedText } from '@/components/ThemedText';
import { Avatar } from '@/components/ui';
import { useLevel } from '@/hooks/useLevel';
import { useCurrentProfile, useStore } from '@/store/useStore';
import { FRAMES } from '@/theme/frames';
import { levelColor, MAX_SHOWCASES, nextSlotLevel, XP } from '@/utils/level';

const HOW: [string, number][] = [
  ['Terminar un juego', XP.beaten],
  ['Sacarlo al 100 %', XP.completed],
  ['Platino Saga Quest', XP.platinum],
  ['Cada rejugada', XP.replay],
  ['Escribir una reseña', XP.review],
  ['Crear una lista', XP.list],
  ['Cada logro', XP.achievement],
  ['Puntuar un juego', XP.rating],
  ['Empezar a jugar uno', XP.playing],
  ['Añadirlo a tu biblioteca', XP.inLibrary],
];

const fmt = (n: number) => n.toLocaleString('es-ES');

// Tu nivel: experiencia, de dónde sale, marcos de la foto y vitrinas.
export default function LevelScreen() {
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const profile = useCurrentProfile();
  const updateProfile = useStore((s) => s.updateProfile);
  const lv = useLevel();
  if (!profile) return null;
  const nextSlot = nextSlotLevel(lv.level);
  const cell = (width - 40 - 3 * 12) / 3;

  return (
    <IgnScreen title="Nivel" back contentStyle={{ paddingHorizontal: 20, gap: 16 }}>
      <Card style={{ alignItems: 'center', gap: 14, paddingVertical: 26 }}>
        <AvatarFrame frame={lv.frame} size={96}>
          <Avatar name={profile.displayName} color={profile.avatarColor} uri={profile.photo} size={96} />
        </AvatarFrame>
        <View style={styles.levelRow}>
          <LevelBadge level={lv.level} size={46} />
          <View>
            <ThemedText variant="display" size={22}>
              Nivel {lv.level}
            </ThemedText>
            <ThemedText variant="muted" size={12}>
              {fmt(lv.xp)} XP en total
            </ThemedText>
          </View>
        </View>
        <View style={{ alignSelf: 'stretch', gap: 6 }}>
          <ProgressBar pct={(lv.into / lv.need) * 100} height={10} color={levelColor(lv.level)} />
          <ThemedText variant="muted" size={12} style={{ textAlign: 'center' }}>
            {fmt(lv.into)} / {fmt(lv.need)} XP para el nivel {lv.level + 1}
          </ThemedText>
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <ThemedText variant="display" size={18}>
          Tu experiencia
        </ThemedText>
        {lv.breakdown.length ? (
          lv.breakdown.map((b) => (
            <View key={b.label} style={styles.line}>
              <ThemedText size={14} style={{ flex: 1 }}>
                {b.label}
              </ThemedText>
              <ThemedText variant="bold" size={14}>
                {fmt(b.xp)} XP
              </ThemedText>
            </View>
          ))
        ) : (
          <ThemedText variant="muted" size={13}>
            Aún no tienes experiencia. ¡Termina tu primer juego!
          </ThemedText>
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <ThemedText variant="display" size={18}>
          Cómo ganar experiencia
        </ThemedText>
        {HOW.map(([label, xp]) => (
          <View key={label} style={styles.line}>
            <ThemedText size={14} style={{ flex: 1 }}>
              {label}
            </ThemedText>
            <ThemedText variant="muted" size={14}>
              +{xp} XP
            </ThemedText>
          </View>
        ))}
      </Card>

      <Pressable onPress={() => router.push('/showcases')}>
        <Card style={styles.line}>
          <Ionicons name="albums-outline" size={22} color={c.text} />
          <View style={{ flex: 1 }}>
            <ThemedText variant="bold" size={15}>
              Vitrinas: {lv.slots} de {MAX_SHOWCASES}
            </ThemedText>
            <ThemedText variant="muted" size={12}>
              {nextSlot ? `Siguiente hueco en el nivel ${nextSlot}` : 'Tienes todos los huecos'}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.muted} />
        </Card>
      </Pressable>

      <ThemedText variant="display" size={20} style={{ marginTop: 8 }}>
        Marcos de la foto
      </ThemedText>
      <ThemedText variant="muted" size={12}>
        Se desbloquea uno cada 3 niveles. Toca uno desbloqueado para ponértelo.
      </ThemedText>
      <View style={styles.grid}>
        <FrameCell
          label="Sin marco"
          sub=""
          active={lv.frame === null}
          locked={false}
          width={cell}
          onPress={() => updateProfile({ frame: null })}
        >
          <Avatar name={profile.displayName} color={profile.avatarColor} uri={profile.photo} size={cell * 0.5} />
        </FrameCell>
        {FRAMES.map((f, i) => {
          const locked = lv.level < f.level;
          return (
            <FrameCell
              key={f.name}
              label={f.name}
              sub={locked ? `Nivel ${f.level}` : `Nivel ${f.level} ✓`}
              active={lv.frame === i}
              locked={locked}
              width={cell}
              onPress={() => updateProfile({ frame: i })}
            >
              <AvatarFrame frame={i} size={cell * 0.5}>
                <Avatar name={profile.displayName} color={profile.avatarColor} uri={profile.photo} size={cell * 0.5} />
              </AvatarFrame>
            </FrameCell>
          );
        })}
      </View>
    </IgnScreen>
  );
}

function FrameCell({
  label,
  sub,
  active,
  locked,
  width,
  onPress,
  children,
}: {
  label: string;
  sub: string;
  active: boolean;
  locked: boolean;
  width: number;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const c = useIgnColors();
  return (
    <Pressable
      disabled={locked}
      onPress={onPress}
      style={[
        styles.cell,
        {
          width,
          borderRadius: c.radius,
          borderColor: active ? c.text : c.line,
          backgroundColor: c.card,
          borderWidth: active ? 2 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View
        style={{ height: width * 0.82, alignItems: 'center', justifyContent: 'center', opacity: locked ? 0.35 : 1 }}
      >
        {children}
      </View>
      {locked ? (
        <View style={styles.lock}>
          <Ionicons name="lock-closed" size={16} color={c.text} />
        </View>
      ) : null}
      <ThemedText variant="bold" size={11} numberOfLines={1}>
        {label}
      </ThemedText>
      {sub ? (
        <ThemedText variant="muted" size={10}>
          {sub}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { alignItems: 'center', paddingBottom: 10, overflow: 'hidden' },
  lock: { position: 'absolute', top: 8, right: 8 },
});
