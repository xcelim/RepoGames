import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { cancelTrade, refreshCards, respondTrade, useCards, type CardTrade } from '@/cloud/cards';
import { useSocial } from '@/cloud/social';
import { GameCard } from '@/components/GameCard';
import { Card, IgnScreen, timeAgo, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { useGameLookup } from '@/hooks/useMyGames';
import { useStore } from '@/store/useStore';
import { notify } from '@/utils/notify';

const STATUS: Record<CardTrade['status'], string> = {
  pending: 'Pendiente',
  accepted: 'Aceptado',
  declined: 'Rechazado',
  cancelled: 'Cancelado',
};

// Intercambios de cromos: los que te proponen y los que has propuesto.
export default function TradesScreen() {
  const uid = useStore((s) => s.cloudUserId);
  const trades = useCards((s) => s.trades);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    refreshCards().catch(() => undefined);
  }, []);

  const act = async (t: CardTrade, what: 'accept' | 'decline' | 'cancel') => {
    setBusy(t.id);
    try {
      if (what === 'cancel') await cancelTrade(t.id);
      else await respondTrade(t.id, what === 'accept');
      notify(what === 'accept' ? '¡Intercambio hecho!' : what === 'decline' ? 'Rechazado' : 'Retirado');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo');
    } finally {
      setBusy(null);
    }
  };

  const incoming = trades.filter((t) => t.to === uid && t.status === 'pending');
  const outgoing = trades.filter((t) => t.from === uid && t.status === 'pending');
  const history = trades.filter((t) => t.status !== 'pending').slice(0, 20);

  return (
    <IgnScreen
      narrow={820}
      title="Intercambios"
      back
      onRefresh={() => refreshCards()}
      contentStyle={{ paddingHorizontal: 20, gap: 14 }}
    >
      <ThemedText variant="bold" size={13} style={styles.caps}>
        Te proponen
      </ThemedText>
      {incoming.length ? (
        incoming.map((t) => <Row key={t.id} t={t} uid={uid} busy={!!busy} act={act} />)
      ) : (
        <Empty text="Nadie te ha propuesto nada." />
      )}
      <ThemedText variant="bold" size={13} style={styles.caps}>
        Has propuesto
      </ThemedText>
      {outgoing.length ? (
        outgoing.map((t) => <Row key={t.id} t={t} uid={uid} busy={!!busy} act={act} />)
      ) : (
        <Empty text="Toca un cromo de tu álbum y «Intercambiar con un amigo»." />
      )}
      {history.length ? (
        <>
          <ThemedText variant="bold" size={13} style={styles.caps}>
            Historial
          </ThemedText>
          {history.map((t) => (
            <Row key={t.id} t={t} uid={uid} busy={!!busy} act={act} />
          ))}
        </>
      ) : null}
    </IgnScreen>
  );
}

type RowProps = {
  t: CardTrade;
  uid: string | null;
  busy: boolean;
  act: (t: CardTrade, what: 'accept' | 'decline' | 'cancel') => void;
};

function Row({ t, uid, busy, act }: RowProps) {
  const tradeCards = useCards((s) => s.tradeCards);
  const profiles = useSocial((s) => s.profiles);
  const lookup = useGameLookup();
  const offer = tradeCards[t.offerCard];
  const want = tradeCards[t.wantCard];
  const mineIn = t.to === uid;
  const other = mineIn ? t.from : t.to;
  // Desde tu lado: lo que recibes y lo que das.
  const give = mineIn ? want : offer;
  const get = mineIn ? offer : want;
  return (
    <Card style={{ gap: 12 }}>
      <ThemedText variant="bold" size={13}>
        {mineIn
          ? `${profiles[other]?.displayName ?? 'Un amigo'} te propone un cambio`
          : `Propuesto a ${profiles[other]?.displayName ?? 'un amigo'}`}
        <ThemedText variant="muted" size={12}>{` · ${timeAgo(t.createdAt)}`}</ThemedText>
      </ThemedText>
      <View style={styles.swap}>
        <View style={styles.side}>
          <ThemedText variant="muted" size={11}>
            DAS
          </ThemedText>
          {give ? <GameCard game={lookup(give.gameId)} rarity={give.rarity} foil={give.foil} width={96} /> : null}
        </View>
        <ThemedText variant="display" size={22}>
          ⇄
        </ThemedText>
        <View style={styles.side}>
          <ThemedText variant="muted" size={11}>
            RECIBES
          </ThemedText>
          {get ? <GameCard game={lookup(get.gameId)} rarity={get.rarity} foil={get.foil} width={96} /> : null}
        </View>
      </View>
      {t.status === 'pending' ? (
        <View style={styles.actions}>
          {mineIn ? (
            <>
              <Btn label="Aceptar" primary onPress={() => busy || act(t, 'accept')} />
              <Btn label="Rechazar" onPress={() => busy || act(t, 'decline')} />
            </>
          ) : (
            <Btn label="Retirar" onPress={() => busy || act(t, 'cancel')} />
          )}
        </View>
      ) : (
        <ThemedText variant="muted" size={12}>
          {STATUS[t.status]}
        </ThemedText>
      )}
    </Card>
  );
}

function Btn({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  const c = useIgnColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.btn,
        {
          borderRadius: c.radius,
          backgroundColor: primary ? c.inverseBg : 'transparent',
          borderColor: c.line,
        },
      ]}
    >
      <ThemedText variant="bold" size={13} style={{ color: primary ? c.inverseText : c.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Card>
      <ThemedText variant="muted" size={14}>
        {text}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  caps: { letterSpacing: 0.8, textTransform: 'uppercase' },
  swap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  side: { alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderWidth: 1 },
});
