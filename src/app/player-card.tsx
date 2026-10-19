import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { PlatinumBadge } from '@/components/achievements';
import { AvatarFrame } from '@/components/AvatarFrame';
import { Backdrop } from '@/components/Backdrop';
import { GameCover } from '@/components/games';
import { DarkButton, IgnScreen } from '@/components/ign';
import { LevelBadge } from '@/components/LevelBadge';
import { RankEmblem } from '@/components/RankBadge';
import { ThemedText } from '@/components/ThemedText';
import { Avatar } from '@/components/ui';
import { useLevel } from '@/hooks/useLevel';
import { useAchievementData } from '@/hooks/usePlatinums';
import { useCurrentProfile, useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';
import type { GameRecord } from '@/types';
import { levelColor } from '@/utils/level';

// Tarjeta de jugador para compartir (como una carta coleccionable).
export default function PlayerCardScreen() {
  const skin = useSkin();
  const { width } = useWindowDimensions();
  const profile = useCurrentProfile();
  const userGames = useStore((s) => s.userGames);
  const games = useStore((s) => s.games);
  const lv = useLevel();
  const { platinums, earned } = useAchievementData();
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!profile) return null;

  const mine = Object.values(userGames).filter((u) => u.profileId === profile.id);
  const finished = mine.filter((u) => u.status === 'beaten' || u.status === 'completed').length;
  const fav = profile.showcases?.find((s) => s.type === 'favorites')?.gameIds ?? [];
  const top: GameRecord[] = (
    fav.length
      ? fav.map((id) => games[id])
      : mine
          .filter((u) => u.rating)
          .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
          .map((u) => games[u.gameId])
  )
    .filter((g): g is GameRecord => !!g)
    .slice(0, 3);
  const cardW = Math.min(width - 40, 360);
  const cover = (cardW - 32 - 16) / 3;

  const share = async () => {
    setMsg('');
    if (Platform.OS === 'web') {
      setMsg('Compartir la tarjeta funciona en el móvil.');
      return;
    }
    try {
      setBusy(true);
      const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Mi tarjeta de Saga Quest' });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo compartir');
    } finally {
      setBusy(false);
    }
  };

  return (
    <IgnScreen title="Tarjeta de jugador" back contentStyle={{ alignItems: 'center', gap: 18, paddingHorizontal: 20 }}>
      <View
        ref={ref}
        collapsable={false}
        style={[styles.card, { width: cardW, backgroundColor: skin.colors.bg, borderColor: levelColor(lv.level) }]}
      >
        <LinearGradient
          colors={[skin.colors.accent + '55', skin.colors.bg, skin.colors.accent2 + '44']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Backdrop />
        <View style={styles.top}>
          <AvatarFrame frame={lv.frame} size={84}>
            <Avatar name={profile.displayName} color={profile.avatarColor} uri={profile.photo} size={84} />
          </AvatarFrame>
          <View style={{ flex: 1, gap: 4 }}>
            <ThemedText variant="display" size={22} numberOfLines={1}>
              {profile.displayName}
            </ThemedText>
            <ThemedText variant="muted" size={12}>
              @{profile.username}
            </ThemedText>
            <View style={styles.row}>
              <LevelBadge level={lv.level} size={30} />
              <ThemedText variant="bold" size={13}>
                Nivel {lv.level}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat value={String(mine.length)} label="JUEGOS" />
          <Stat value={String(finished)} label="TERMINADOS" />
          <Stat value={String(earned.length)} label="LOGROS" />
          <View style={styles.stat}>
            <View style={styles.row}>
              <PlatinumBadge size={18} />
              <ThemedText variant="bold" size={18}>
                {platinums.length}
              </ThemedText>
            </View>
            <ThemedText variant="muted" size={9} style={styles.caps}>
              PLATINOS
            </ThemedText>
          </View>
        </View>

        {top.length ? (
          <View style={styles.covers}>
            {top.map((g) => (
              <GameCover key={g.id} game={g} width={cover} plain />
            ))}
          </View>
        ) : null}

        {profile.ranks?.length ? (
          <View style={styles.ranks}>
            {profile.ranks.slice(0, 4).map((r) => (
              <RankEmblem key={r.game} rank={r} size={40} />
            ))}
          </View>
        ) : null}

        <ThemedText variant="muted" size={10} style={[styles.caps, { textAlign: 'center', marginTop: 4 }]}>
          SAGA QUEST
        </ThemedText>
      </View>

      <DarkButton
        label={busy ? 'Preparando…' : 'Compartir tarjeta'}
        icon="share-outline"
        disabled={busy}
        onPress={share}
      />
      {msg ? (
        <ThemedText variant="muted" size={12}>
          {msg}
        </ThemedText>
      ) : null}
    </IgnScreen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText variant="bold" size={18}>
        {value}
      </ThemedText>
      <ThemedText variant="muted" size={9} style={styles.caps}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 3, padding: 16, gap: 16, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stats: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 14, paddingVertical: 12 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  caps: { letterSpacing: 1 },
  covers: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  ranks: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
});
