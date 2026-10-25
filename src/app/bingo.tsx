import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { celebrate } from '@/components/Celebration';
import { Card, IgnScreen, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { MONTHS_LONG, todayIso, useMyGames } from '@/hooks/useMyGames';
import { useStore } from '@/store/useStore';
import { bingoCard, bingoContext, bingoLines } from '@/utils/bingo';

// Bingo gamer: un cartón nuevo cada mes que se marca solo con lo que juegas.
export default function BingoScreen() {
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const mine = useMyGames();
  const mode = useStore((s) => s.durationMode);
  const uid = useStore((s) => s.cloudUserId ?? s.currentProfileId ?? 'yo');
  const month = todayIso().slice(0, 7);
  const [info, setInfo] = useState<number | null>(null);

  const card = useMemo(() => bingoCard(uid, month), [uid, month]);
  const ctx = useMemo(() => bingoContext(mine, month, mode), [mine, month, mode]);
  const marked = useMemo(() => card.map((cell) => (cell ? cell.done(ctx) : true)), [card, ctx]);
  const lines = bingoLines(marked);
  const full = marked.every(Boolean);
  const inLine = new Set(lines.flat());
  const doneCount = marked.filter(Boolean).length - 1;

  // Celebración la primera vez que haces línea, bingo de 3 líneas o cartón lleno este mes.
  useEffect(() => {
    const key = `bingo:${month}:seen`;
    const level = full ? 3 : lines.length >= 3 ? 2 : lines.length >= 1 ? 1 : 0;
    if (!level) return;
    AsyncStorage.getItem(key)
      .then((v) => {
        if (Number(v ?? 0) >= level) return;
        AsyncStorage.setItem(key, String(level)).catch(() => undefined);
        celebrate({
          kind: level === 3 ? 'platinum' : 'finish',
          heading: level === 3 ? '¡CARTÓN LLENO!' : level === 2 ? '¡BINGO!' : '¡LÍNEA!',
          title:
            level === 3
              ? 'Has completado el bingo del mes'
              : level === 2
                ? 'Tres líneas en el cartón'
                : 'Primera línea del mes',
        });
      })
      .catch(() => undefined);
  }, [lines.length, full, month]);

  const cell = Math.floor((Math.min(width, 640) - 40 - 4 * 6) / 5);
  const [y, m] = month.split('-').map(Number);

  return (
    <IgnScreen title="Bingo gamer" back contentStyle={{ paddingHorizontal: 20, gap: 16 }}>
      <LinearGradient colors={['#f7971e', '#ffd200']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={{ flex: 1 }}>
          <ThemedText variant="display" size={22} style={{ color: '#111' }}>
            {`${MONTHS_LONG[m - 1].toUpperCase()} ${y}`}
          </ThemedText>
          <ThemedText size={13} style={{ color: '#111b' }}>
            {`${doneCount}/24 casillas · ${lines.length} ${lines.length === 1 ? 'línea' : 'líneas'}${full ? ' · ¡CARTÓN LLENO!' : ''}`}
          </ThemedText>
        </View>
        <Ionicons name="grid" size={38} color="#111" />
      </LinearGradient>

      <View style={[styles.board, { width: cell * 5 + 4 * 6, alignSelf: 'center' }]}>
        {card.map((ch, i) => {
          const on = marked[i];
          const lit = inLine.has(i);
          return (
            <Pressable
              key={i}
              onPress={() => setInfo(i)}
              style={[
                styles.cell,
                {
                  width: cell,
                  height: cell,
                  borderRadius: 10,
                  backgroundColor: lit ? '#ffd200' : on ? c.accent : c.card,
                  borderColor: info === i ? c.text : c.line,
                },
              ]}
            >
              {ch ? (
                <>
                  <Ionicons
                    name={(on ? 'checkmark-circle' : ch.icon) as never}
                    size={cell * 0.3}
                    color={lit ? '#111' : on ? '#fff' : c.muted}
                  />
                  <ThemedText
                    size={Math.max(8, cell * 0.105)}
                    numberOfLines={3}
                    style={{
                      textAlign: 'center',
                      color: lit ? '#111' : on ? '#fff' : c.text,
                    }}
                  >
                    {ch.text}
                  </ThemedText>
                </>
              ) : (
                <>
                  <Ionicons name="star" size={cell * 0.36} color={lit ? '#111' : '#ffd200'} />
                  <ThemedText variant="bold" size={Math.max(8, cell * 0.11)} style={{ color: lit ? '#111' : c.text }}>
                    LIBRE
                  </ThemedText>
                </>
              )}
            </Pressable>
          );
        })}
      </View>

      {info != null && card[info] ? (
        <Card style={{ gap: 4 }}>
          <ThemedText variant="bold" size={15}>
            {card[info]!.text}
          </ThemedText>
          <ThemedText variant="muted" size={13}>
            {marked[info] ? '¡Hecho este mes! ✓' : 'Se marca sola cuando lo hagas este mes.'}
          </ThemedText>
        </Card>
      ) : null}

      <Card style={{ gap: 6 }}>
        <ThemedText variant="bold" size={13}>
          Cómo funciona
        </ThemedText>
        <ThemedText variant="muted" size={13}>
          {`Las casillas se marcan solas con lo que haces en ${MONTHS_LONG[m - 1]} (terminar, empezar, poner nota…). Haz línea en horizontal, vertical o diagonal. El día 1 sale un cartón nuevo. Hoy es ${todayIso().slice(8)} de ${MONTHS_LONG[m - 1]}.`}
        </ThemedText>
      </Card>
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  board: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    gap: 2,
    borderWidth: 1.5,
  },
});
