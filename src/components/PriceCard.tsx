import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { eur, gamePrice, pricesAvailable, usd, type PriceInfo } from '@/api/prices';
import type { GameRecord } from '@/types';

import { Card, useIgnColors } from './ign';
import { ThemedText } from './ThemedText';

// Dónde comprarlo más barato (Steam en euros y la mejor tienda de PC).
export function PriceCard({ game }: { game: GameRecord }) {
  const c = useIgnColors();
  const [price, setPrice] = useState<PriceInfo | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (!pricesAvailable()) return;
    gamePrice(game)
      .then((p) => alive && setPrice(p))
      .catch(() => alive && setPrice(null));
    return () => {
      alive = false;
    };
  }, [game]);

  if (!pricesAvailable() || price === null) return null;
  if (price && !price.steam && !price.best) return null;

  return (
    <Card style={{ gap: 12 }}>
      <View style={styles.head}>
        <Ionicons name="pricetags" size={18} color={c.text} />
        <ThemedText variant="display" size={19} style={{ flex: 1 }}>
          Precios
        </ThemedText>
        {price === undefined ? (
          <ThemedText variant="muted" size={12}>
            Buscando…
          </ThemedText>
        ) : null}
      </View>
      {price?.steam ? (
        <Pressable
          onPress={() => price.steamAppId && Linking.openURL(`https://store.steampowered.com/app/${price.steamAppId}`)}
          style={[styles.row, { backgroundColor: c.soft, borderRadius: c.radius }]}
        >
          <Ionicons name="logo-steam" size={22} color={c.text} />
          <View style={{ flex: 1 }}>
            <ThemedText variant="bold" size={14}>
              Steam
            </ThemedText>
            {price.steam.discount > 0 ? (
              <ThemedText variant="muted" size={12} style={{ textDecorationLine: 'line-through' }}>
                {eur(price.steam.initial)}
              </ThemedText>
            ) : null}
          </View>
          {price.steam.discount > 0 ? <Discount pct={price.steam.discount} /> : null}
          <ThemedText variant="display" size={18}>
            {price.steam.free ? 'Gratis' : eur(price.steam.final)}
          </ThemedText>
        </Pressable>
      ) : null}
      {price?.best ? (
        <Pressable
          onPress={() => Linking.openURL(price.best!.url)}
          style={[styles.row, { backgroundColor: c.soft, borderRadius: c.radius }]}
        >
          <Ionicons name="cart" size={22} color={c.text} />
          <View style={{ flex: 1 }}>
            <ThemedText variant="bold" size={14}>
              {`Mejor oferta PC · ${price.best.store}`}
            </ThemedText>
            {price.lowest ? (
              <ThemedText variant="muted" size={12}>
                {`Mínimo histórico: ${usd(price.lowest.price)}`}
              </ThemedText>
            ) : null}
          </View>
          {price.best.savings > 0 ? <Discount pct={price.best.savings} /> : null}
          <ThemedText variant="display" size={18}>
            {usd(price.best.price)}
          </ThemedText>
        </Pressable>
      ) : null}
      {price ? (
        <ThemedText variant="muted" size={11}>
          Precios de PC. PlayStation, Xbox y Nintendo no publican sus precios para otras apps.
        </ThemedText>
      ) : null}
    </Card>
  );
}

export function Discount({ pct }: { pct: number }) {
  return (
    <View style={styles.discount}>
      <ThemedText variant="bold" size={12} style={{ color: '#fff' }}>
        {`-${pct} %`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  discount: { backgroundColor: '#2fa84f', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
});
