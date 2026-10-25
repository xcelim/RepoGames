import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { groupAlbum, loadFriendCards, proposeTrade, useCards, type GameCardItem } from '@/cloud/cards';
import { friendIds, useSocial } from '@/cloud/social';
import { GameCard } from '@/components/GameCard';
import { Card, DarkButton, IgnScreen, Sheet, useIgnColors } from '@/components/ign';
import { PersonRow } from '@/components/PersonRow';
import { ThemedText } from '@/components/ThemedText';
import { useGameLookup } from '@/hooks/useMyGames';
import { notify } from '@/utils/notify';

// Intercambiar un cromo: eliges amigo, eliges uno de sus cromos y se lo propones.
export default function TradeScreen() {
  const { offer } = useLocalSearchParams<{ offer: string }>();
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const lookup = useGameLookup();
  const mine = useCards((s) => s.mine);
  const { friendships, profiles } = useSocial(
    useShallow((s) => ({ friendships: s.friendships, profiles: s.profiles })),
  );
  const friends = useMemo(() => {
    void friendships;
    return friendIds();
  }, [friendships]);
  const [friend, setFriend] = useState<string | null>(null);
  const [theirs, setTheirs] = useState<GameCardItem[] | null>(null);
  const [want, setWant] = useState<GameCardItem | null>(null);
  const [busy, setBusy] = useState(false);
  const offered = mine.find((x) => x.id === offer);

  useEffect(() => {
    if (!friend) return;
    let alive = true;
    loadFriendCards(friend)
      .then((list) => alive && setTheirs(list))
      .catch(() => alive && setTheirs([]));
    return () => {
      alive = false;
    };
  }, [friend]);

  const cols = Math.max(3, Math.floor((width - 40 + 10) / (120 + 10)));
  const cardW = (width - 40 - 10 * (cols - 1)) / cols;
  const album = useMemo(() => groupAlbum(theirs ?? []), [theirs]);
  const mineGames = new Set(mine.map((x) => x.gameId));

  const send = async () => {
    if (!offered || !want) return;
    setBusy(true);
    try {
      await proposeTrade(offered.id, want.id);
      notify('Intercambio propuesto: cuando lo acepte, se cambian los cromos');
      router.replace('/cards/trades');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo proponer');
    } finally {
      setBusy(false);
    }
  };

  return (
    <IgnScreen title="Intercambiar" back contentStyle={{ paddingHorizontal: 20, gap: 16 }}>
      {offered ? (
        <View style={styles.offer}>
          <GameCard game={lookup(offered.gameId)} rarity={offered.rarity} foil={offered.foil} width={90} />
          <View style={{ flex: 1, gap: 4 }}>
            <ThemedText variant="muted" size={12}>
              OFRECES
            </ThemedText>
            <ThemedText variant="bold" size={16}>
              {lookup(offered.gameId)?.title ?? 'Tu cromo'}
            </ThemedText>
          </View>
        </View>
      ) : (
        <Card>
          <ThemedText variant="muted">Ese cromo ya no está en tu álbum.</ThemedText>
        </Card>
      )}

      {!friend ? (
        <>
          <ThemedText variant="bold" size={13} style={styles.caps}>
            ¿Con quién?
          </ThemedText>
          {friends.length ? (
            friends.map((id) => <PersonRow key={id} profile={profiles[id]} onPress={() => setFriend(id)} />)
          ) : (
            <Card>
              <ThemedText variant="muted">Añade amigos para intercambiar cromos.</ThemedText>
            </Card>
          )}
        </>
      ) : (
        <>
          <Pressable onPress={() => (setFriend(null), setTheirs(null))}>
            <ThemedText variant="bold" size={13} style={styles.caps}>
              {`Cromos de ${profiles[friend]?.displayName ?? 'tu amigo'} · cambiar de amigo`}
            </ThemedText>
          </Pressable>
          {theirs === null ? <ActivityIndicator color={c.text} /> : null}
          {theirs && !theirs.length ? (
            <Card>
              <ThemedText variant="muted">Aún no tiene cromos.</ThemedText>
            </Card>
          ) : null}
          <ThemedText variant="muted" size={12}>
            Los que tú no tienes salen marcados con ✚.
          </ThemedText>
          <View style={styles.grid}>
            {album.map((e) => (
              <Pressable key={e.gameId} onPress={() => setWant(e.best)}>
                <GameCard
                  game={lookup(e.gameId)}
                  rarity={e.best.rarity}
                  foil={e.best.foil}
                  width={cardW}
                  count={e.copies.length}
                />
                {!mineGames.has(e.gameId) ? (
                  <View style={[styles.newTag, { backgroundColor: c.accent }]}>
                    <ThemedText variant="bold" size={11} style={{ color: '#fff' }}>
                      ✚
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Sheet visible={!!want} title="Proponer intercambio" onClose={() => setWant(null)} doneLabel={null}>
        {offered && want ? (
          <View style={{ gap: 14, alignItems: 'center' }}>
            <View style={styles.swap}>
              <GameCard game={lookup(offered.gameId)} rarity={offered.rarity} foil={offered.foil} width={110} />
              <ThemedText variant="display" size={24}>
                ⇄
              </ThemedText>
              <GameCard game={lookup(want.gameId)} rarity={want.rarity} foil={want.foil} width={110} />
            </View>
            <DarkButton
              label={busy ? 'Enviando…' : 'Proponer'}
              icon="swap-horizontal"
              onPress={send}
              disabled={busy}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        ) : null}
      </Sheet>
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  offer: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  caps: { letterSpacing: 0.8, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  newTag: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
