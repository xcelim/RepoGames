import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { bestDiscount, cachedPrice, eur, pricesAvailable, pricesFor, usd, type PriceInfo } from '@/api/prices';
import { GameCover } from '@/components/games';
import { Card, IgnScreen, ToggleRow, useIgnColors } from '@/components/ign';
import { Discount } from '@/components/PriceCard';
import { ThemedText } from '@/components/ThemedText';
import { useMyGames } from '@/hooks/useMyGames';
import { ALERTS_OFF, dealAlertsOn } from '@/utils/dealAlerts';

type Scope = 'wishlist' | 'backlog';

// Ofertas: el precio de tus deseados (o pendientes) en PC, ordenados por descuento.
export default function DealsScreen() {
  const c = useIgnColors();
  const mine = useMyGames();
  const [scope, setScope] = useState<Scope>('wishlist');
  const [prices, setPrices] = useState<Record<string, PriceInfo | null>>({});
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState(true);
  const games = useMemo(
    () => mine.filter((m) => m.ug.status === scope && m.game.source !== 'custom').map((m) => m.game),
    [mine, scope],
  );

  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      // Primero lo guardado (sale al momento) y luego lo de las tiendas.
      const cached = await Promise.all(games.map((g) => cachedPrice(g).then((p) => [g.id, p] as const)));
      setPrices((old) => ({ ...old, ...Object.fromEntries(cached.filter(([, p]) => p)) }));
      await pricesFor(games, (id, p) => setPrices((old) => ({ ...old, [id]: p })), force);
      setLoading(false);
    },
    [games],
  );
  useEffect(() => {
    if (!pricesAvailable()) return;
    const t = setTimeout(() => {
      load().catch(() => setLoading(false));
    }, 0);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    dealAlertsOn().then(setAlerts);
  }, []);

  const sorted = useMemo(
    () =>
      [...games].sort(
        (a, b) =>
          bestDiscount(prices[b.id] ?? null) - bestDiscount(prices[a.id] ?? null) || a.title.localeCompare(b.title),
      ),
    [games, prices],
  );
  const onSale = sorted.filter((g) => bestDiscount(prices[g.id] ?? null) > 0).length;

  return (
    <IgnScreen
      narrow={820}
      title="Ofertas"
      back
      onRefresh={() => load(true)}
      contentStyle={{ paddingHorizontal: 20, gap: 14 }}
    >
      <View style={[styles.tabs, { backgroundColor: c.soft, borderRadius: c.radius }]}>
        {(
          [
            ['wishlist', 'Deseados'],
            ['backlog', 'Pendientes'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setScope(id)}
            style={[
              styles.tab,
              { borderRadius: c.radius, backgroundColor: scope === id ? c.inverseBg : 'transparent' },
            ]}
          >
            <ThemedText variant="bold" size={13} style={{ color: scope === id ? c.inverseText : c.text }}>
              {label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {!pricesAvailable() ? (
        <Card>
          <ThemedText variant="muted" size={14}>
            Esta versión no puede consultar precios.
          </ThemedText>
        </Card>
      ) : (
        <ThemedText variant="muted" size={13}>
          {loading
            ? `Mirando precios… (${Object.keys(prices).filter((id) => games.some((g) => g.id === id)).length}/${games.length})`
            : `${onSale} de ${games.length} juegos están rebajados ahora mismo`}
        </ThemedText>
      )}

      {scope === 'wishlist' && pricesAvailable() ? (
        <ToggleRow
          label="Avisarme de rebajas"
          caption="Una vez al día miro tus deseados y te aviso si alguno baja un 20 % o más"
          value={alerts}
          onChange={(v) => {
            setAlerts(v);
            AsyncStorage.setItem(ALERTS_OFF, v ? '0' : '1').catch(() => undefined);
          }}
        />
      ) : null}

      {!games.length ? (
        <Card>
          <ThemedText variant="muted" size={14}>
            {scope === 'wishlist'
              ? 'No tienes juegos en deseados. Márcalos como «Lo quiero» y aquí verás sus ofertas.'
              : 'No tienes juegos pendientes.'}
          </ThemedText>
        </Card>
      ) : null}

      {sorted.map((g) => {
        const p = prices[g.id];
        const pct = bestDiscount(p ?? null);
        return (
          <Pressable key={g.id} onPress={() => router.push(`/game/${encodeURIComponent(g.id)}`)}>
            <Card style={styles.row}>
              <GameCover game={g} width={52} />
              <View style={{ flex: 1, gap: 3 }}>
                <ThemedText variant="bold" size={14} numberOfLines={2}>
                  {g.title}
                </ThemedText>
                {p === undefined ? (
                  <ThemedText variant="muted" size={12}>
                    …
                  </ThemedText>
                ) : !p || (!p.steam && !p.best) ? (
                  <ThemedText variant="muted" size={12}>
                    Sin precio en PC
                  </ThemedText>
                ) : (
                  <>
                    {p.steam ? (
                      <ThemedText size={12}>
                        {`Steam: ${p.steam.free ? 'Gratis' : eur(p.steam.final)}${p.steam.discount ? ` (-${p.steam.discount} %)` : ''}`}
                      </ThemedText>
                    ) : null}
                    {p.best ? (
                      <ThemedText variant="muted" size={12}>
                        {`${p.best.store}: ${usd(p.best.price)}${p.lowest ? ` · mín. ${usd(p.lowest.price)}` : ''}`}
                      </ThemedText>
                    ) : null}
                  </>
                )}
              </View>
              {pct > 0 ? <Discount pct={pct} /> : <Ionicons name="chevron-forward" size={18} color={c.muted} />}
            </Card>
          </Pressable>
        );
      })}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
