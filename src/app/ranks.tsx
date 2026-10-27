import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, DarkButton, IgnScreen, useIgnColors } from '@/components/ign';
import { RankBadge, RankEmblem } from '@/components/RankBadge';
import { ThemedText } from '@/components/ThemedText';
import { TextField } from '@/components/ui';
import { RANKED_GAMES } from '@/data/ranks';
import { useCurrentProfile, useStore } from '@/store/useStore';
import type { CompetitiveRank } from '@/types';
import { HScroll } from '@/components/HScroll';

const MAX = 6;

// Tus rangos en competitivos, para lucirlos en el perfil.
export default function RanksScreen() {
  const c = useIgnColors();
  const profile = useCurrentProfile();
  const updateProfile = useStore((s) => s.updateProfile);
  const [gameId, setGameId] = useState(RANKED_GAMES[0].id);
  const [custom, setCustom] = useState('');
  const [tier, setTier] = useState<string | null>(null);
  const [division, setDivision] = useState<string | null>(null);
  if (!profile) return null;
  const ranks = profile.ranks ?? [];
  const game = RANKED_GAMES.find((g) => g.id === gameId)!;
  const key = gameId === 'other' ? `other:${custom.trim()}` : gameId;
  const preview: CompetitiveRank | null = tier ? { game: key, tier, ...(division ? { division } : {}) } : null;

  const add = () => {
    if (!preview || (gameId === 'other' && !custom.trim())) return;
    // Un rango por juego: si ya estaba, se cambia.
    const rest = ranks.filter((r) => r.game !== key);
    updateProfile({ ranks: [...rest, preview].slice(-MAX) });
    setTier(null);
    setDivision(null);
  };

  const chip = (label: string, active: boolean, onPress: () => void, color?: string) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: color ?? c.line,
          backgroundColor: active ? (color ?? c.inverseBg) : 'transparent',
          borderRadius: c.radius,
        },
      ]}
    >
      <ThemedText variant="bold" size={12} style={{ color: active ? (color ? '#000' : c.inverseText) : c.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );

  return (
    <IgnScreen narrow={860} title="Rangos" close contentStyle={{ paddingHorizontal: 20, gap: 16 }}>
      <ThemedText variant="muted" size={13}>
        Ponte las insignias de tu rango en los competitivos que juegas (hasta {MAX}). Las dibuja la app: no son los
        emblemas oficiales.
      </ThemedText>

      {ranks.length ? (
        <Card>
          <View style={styles.badges}>
            {ranks.map((r) => (
              <Pressable
                key={r.game}
                onPress={() => updateProfile({ ranks: ranks.filter((x) => x.game !== r.game) })}
                style={{ alignItems: 'center' }}
              >
                <RankBadge rank={r} size={52} />
                <Ionicons name="close-circle" size={18} color={c.muted} style={styles.remove} />
              </Pressable>
            ))}
          </View>
          <ThemedText variant="muted" size={11} style={{ textAlign: 'center', marginTop: 8 }}>
            Toca una insignia para quitarla.
          </ThemedText>
        </Card>
      ) : null}

      <Card style={{ gap: 12 }}>
        <ThemedText variant="display" size={18}>
          Añadir rango
        </ThemedText>
        <ThemedText variant="bold" size={13}>
          Juego
        </ThemedText>
        <HScroll contentContainerStyle={styles.chips}>
          {RANKED_GAMES.map((g) =>
            chip(g.name, g.id === gameId, () => {
              setGameId(g.id);
              setTier(null);
              setDivision(null);
            }),
          )}
        </HScroll>
        {gameId === 'other' ? (
          <TextField value={custom} onChangeText={setCustom} placeholder="Nombre del juego" maxLength={24} />
        ) : null}
        <ThemedText variant="bold" size={13}>
          Rango
        </ThemedText>
        <View style={styles.wrap}>
          {game.tiers.map((t) => chip(t.name, t.name === tier, () => setTier(t.name), t.color))}
        </View>
        {game.divisions ? (
          <>
            <ThemedText variant="bold" size={13}>
              División
            </ThemedText>
            <View style={styles.wrap}>
              {chip('Ninguna', division === null, () => setDivision(null))}
              {game.divisions.map((d) => chip(d, d === division, () => setDivision(d)))}
            </View>
          </>
        ) : null}
        {preview ? (
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <RankEmblem rank={preview} size={86} />
          </View>
        ) : null}
        <DarkButton
          label="Ponerme esta insignia"
          disabled={!preview || (gameId === 'other' && !custom.trim())}
          onPress={add}
        />
      </Card>
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  remove: { position: 'absolute', top: -4, right: 6 },
  chips: { gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5 },
});
