import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DarkButton, LightButton, Sheet, useIgnColors } from '@/components/ign';
import { IsoCity, type IsoCityHandle } from '@/components/IsoCity';
import { ScreenHeader } from '@/components/lists';
import { ThemedText } from '@/components/ThemedText';
import { useMyGames } from '@/hooks/useMyGames';
import { useCurrentProfile, useStore } from '@/store/useStore';
import type { CityItem, CityState } from '@/types';
import {
  type Building,
  cityOf,
  COINS_PER_HOUR,
  coinsEarned,
  DECOR,
  DECOR_KINDS,
  type DecorKind,
  expandCost,
  layoutCity,
  MAX_LEVEL,
  SKIES,
  upgradeCost,
} from '@/utils/city';
import { notify } from '@/utils/notify';

const fmt = (n: number) => n.toLocaleString('es-ES');
const buzz = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
};

// Mundo gamer: tu ciudad en 3D isométrico. Cada juego terminado es un edificio y tus horas, monedas.
export default function WorldScreen() {
  const c = useIgnColors();
  const insets = useSafeAreaInsets();
  const mine = useMyGames();
  const profile = useCurrentProfile();
  const updateProfile = useStore((s) => s.updateProfile);
  const city = useMemo(() => cityOf(profile?.city), [profile?.city]);
  const earned = coinsEarned(mine);
  const coins = Math.max(0, earned - city.spent);
  const { buildings, homeless } = useMemo(() => layoutCity(mine, city), [mine, city]);
  const map = useRef<IsoCityHandle>(null);

  const [shop, setShop] = useState(false);
  const [tab, setTab] = useState<'decor' | 'sky' | 'land'>('decor');
  const [placing, setPlacing] = useState<DecorKind | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [item, setItem] = useState<CityItem | null>(null);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [info, setInfo] = useState(false);

  const save = (next: CityState) => updateProfile({ city: next });
  const pay = (cost: number): boolean => {
    if (coins < cost) {
      notify(`Te faltan ${fmt(cost - coins)} monedas: ¡a jugar!`);
      return false;
    }
    return true;
  };

  const onTapTile = (x: number, y: number) => {
    if (!placing) {
      setSelected(null);
      return;
    }
    if (city.items.some((i) => i.x === x && i.y === y) || buildings.some((b) => b.x === x && b.y === y)) {
      notify('Esa casilla está ocupada');
      return;
    }
    const cost = DECOR[placing].price;
    if (!pay(cost)) return;
    buzz();
    save({
      ...city,
      spent: city.spent + cost,
      items: [
        ...city.items,
        { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, kind: placing, x, y },
      ],
    });
    // Sigue colocando del mismo tipo mientras te lo puedas permitir.
    if (coins - cost < cost) setPlacing(null);
  };

  const upgrade = (b: Building) => {
    const cost = upgradeCost(b.level);
    if (cost == null || !pay(cost)) return;
    buzz();
    save({ ...city, spent: city.spent + cost, upgrades: { ...city.upgrades, [b.game.game.id]: b.level + 1 } });
    setBuilding({ ...b, level: b.level + 1, floors: b.floors + 1 });
    notify(`🏗️ ${b.game.game.title} sube a nivel ${b.level + 1}`);
  };

  const removeItem = (it: CityItem) => {
    const refund = Math.floor((DECOR[it.kind as DecorKind]?.price ?? 0) / 2);
    save({ ...city, spent: Math.max(0, city.spent - refund), items: city.items.filter((i) => i.id !== it.id) });
    setItem(null);
  };

  const buySky = (id: string) => {
    if (city.skies?.includes(id)) return save({ ...city, sky: id });
    const cost = SKIES[id].price;
    if (!pay(cost)) return;
    buzz();
    save({ ...city, spent: city.spent + cost, sky: id, skies: [...(city.skies ?? ['day']), id] });
  };

  const expand = () => {
    const cost = expandCost(city.size);
    if (cost == null || !pay(cost)) return;
    buzz();
    save({ ...city, spent: city.spent + cost, size: city.size + 2 });
    setTimeout(() => map.current?.center(), 50);
  };

  const population = buildings.reduce((a, b) => a + (b.construction ? 0 : b.floors * 40), 0) + city.items.length * 5;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader
        back
        title="Mundo gamer"
        right={
          <Pressable onPress={() => setInfo(true)} hitSlop={8} accessibilityLabel="Cómo funciona">
            <Ionicons name="information-circle-outline" size={24} color={c.text} />
          </Pressable>
        }
      />
      <View style={styles.stats}>
        <Stat label="Monedas" value={`🪙 ${fmt(coins)}`} />
        <Stat label="Edificios" value={fmt(buildings.filter((b) => !b.construction).length)} />
        <Stat label="Población" value={fmt(population)} />
      </View>

      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <IsoCity
          ref={map}
          city={city}
          buildings={buildings}
          placing={!!placing}
          selected={selected}
          onTapTile={onTapTile}
          onTapBuilding={(b) => {
            setSelected({ x: b.x, y: b.y });
            setBuilding(b);
          }}
          onTapItem={(it) => {
            setSelected({ x: it.x, y: it.y });
            setItem(it);
          }}
        />
        <View style={styles.zoom}>
          <ZoomButton icon="add" onPress={() => map.current?.zoom(1.25)} />
          <ZoomButton icon="remove" onPress={() => map.current?.zoom(0.8)} />
          <ZoomButton icon="scan" onPress={() => map.current?.center()} />
        </View>
        {placing ? (
          <View style={[styles.placing, { backgroundColor: c.inverseBg, borderRadius: c.radius }]}>
            <Text style={{ fontSize: 20 }}>{DECOR[placing].icon}</Text>
            <ThemedText variant="bold" size={13} style={{ flex: 1, color: c.inverseText }}>
              {`Toca una casilla amarilla · ${DECOR[placing].price} 🪙`}
            </ThemedText>
            <Pressable onPress={() => setPlacing(null)} hitSlop={8}>
              <ThemedText variant="bold" size={13} style={{ color: c.inverseText, textDecorationLine: 'underline' }}>
                Listo
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
        {homeless && !placing ? (
          <View style={[styles.placing, { backgroundColor: '#e5484d', borderRadius: c.radius }]}>
            <Ionicons name="warning" size={18} color="#fff" />
            <ThemedText variant="bold" size={12} style={{ flex: 1, color: '#fff' }}>
              {`${homeless} ${homeless === 1 ? 'edificio no cabe' : 'edificios no caben'}: amplía tu terreno en la tienda`}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <DarkButton label="Tienda" icon="storefront" onPress={() => setShop(true)} style={{ flex: 1 }} />
        <LightButton label="Ver mi biblioteca" onPress={() => router.push('/library')} style={{ flex: 1 }} />
      </View>

      {/* Tienda */}
      <Sheet visible={shop} title={`Tienda · 🪙 ${fmt(coins)}`} onClose={() => setShop(false)}>
        <View style={[styles.tabs, { backgroundColor: c.soft, borderRadius: c.radius }]}>
          {(
            [
              ['decor', 'Decoración'],
              ['sky', 'Cielo'],
              ['land', 'Terreno'],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={[
                styles.tab,
                { borderRadius: c.radius, backgroundColor: tab === id ? c.inverseBg : 'transparent' },
              ]}
            >
              <ThemedText variant="bold" size={12} style={{ color: tab === id ? c.inverseText : c.text }}>
                {label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        {tab === 'decor' ? (
          <View style={styles.grid}>
            {DECOR_KINDS.map((k) => {
              const d = DECOR[k];
              const can = coins >= d.price;
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    if (!pay(d.price)) return;
                    if (buildings.length + city.items.length >= city.size * city.size) {
                      notify('No queda sitio libre: amplía el terreno en la pestaña «Terreno»');
                      setTab('land');
                      return;
                    }
                    setPlacing(k);
                    setShop(false);
                    setSelected(null);
                  }}
                  style={[
                    styles.shopItem,
                    { backgroundColor: c.soft, borderRadius: c.radius, opacity: can ? 1 : 0.45 },
                  ]}
                >
                  <Text style={{ fontSize: 28, lineHeight: 34 }}>{d.icon}</Text>
                  <ThemedText variant="bold" size={12} numberOfLines={1}>
                    {d.name}
                  </ThemedText>
                  <ThemedText variant="muted" size={11}>{`🪙 ${d.price}`}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : tab === 'sky' ? (
          <View style={{ gap: 8, marginTop: 12 }}>
            {Object.entries(SKIES).map(([id, s]) => {
              const owned = city.skies?.includes(id);
              return (
                <Pressable
                  key={id}
                  onPress={() => buySky(id)}
                  style={[
                    styles.skyRow,
                    { borderRadius: c.radius, borderColor: city.sky === id ? c.text : c.line, backgroundColor: c.soft },
                  ]}
                >
                  <View style={[styles.skySwatch, { backgroundColor: s.colors[0], borderColor: s.colors[1] }]} />
                  <ThemedText variant="bold" size={14} style={{ flex: 1 }}>
                    {s.name}
                  </ThemedText>
                  <ThemedText variant="muted" size={12}>
                    {city.sky === id ? 'Puesto' : owned ? 'Poner' : `🪙 ${s.price}`}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 12 }}>
            <ThemedText size={14}>{`Tu terreno mide ${city.size}×${city.size} casillas.`}</ThemedText>
            {expandCost(city.size) != null ? (
              <DarkButton
                label={`Ampliar a ${city.size + 2}×${city.size + 2} · 🪙 ${fmt(expandCost(city.size)!)}`}
                icon="expand"
                onPress={expand}
              />
            ) : (
              <ThemedText variant="muted" size={13}>
                ¡Ya tienes el terreno más grande!
              </ThemedText>
            )}
          </View>
        )}
      </Sheet>

      {/* Edificio */}
      <Sheet
        visible={!!building}
        title="Edificio"
        onClose={() => {
          setBuilding(null);
          setSelected(null);
        }}
      >
        {building ? (
          <View style={{ gap: 10 }}>
            <ThemedText variant="display" size={20}>
              {building.game.game.title}
            </ThemedText>
            <ThemedText variant="muted" size={13}>
              {building.construction
                ? 'En obras: lo estás jugando. Cuando lo termines, se levantará el edificio.'
                : `${building.floors} plantas · nivel ${building.level}/${MAX_LEVEL}${building.gold ? ' · completado al 100 % (dorado)' : ''}`}
            </ThemedText>
            {!building.construction && building.level < MAX_LEVEL ? (
              <DarkButton
                label={`Mejorar a nivel ${building.level + 1} · 🪙 ${upgradeCost(building.level)}`}
                icon="trending-up"
                onPress={() => upgrade(building)}
              />
            ) : !building.construction ? (
              <ThemedText variant="bold" size={13}>
                ¡Nivel máximo! 👑
              </ThemedText>
            ) : null}
            <LightButton
              label="Ver juego"
              onPress={() => {
                const id = building.game.game.id;
                setBuilding(null);
                router.push(`/game/${encodeURIComponent(id)}`);
              }}
            />
          </View>
        ) : null}
      </Sheet>

      {/* Decoración */}
      <Sheet
        visible={!!item}
        title="Decoración"
        onClose={() => {
          setItem(null);
          setSelected(null);
        }}
      >
        {item ? (
          <View style={{ gap: 10, alignItems: 'center' }}>
            <Text style={{ fontSize: 40, lineHeight: 50 }}>{DECOR[item.kind as DecorKind]?.icon}</Text>
            <ThemedText variant="display" size={18}>
              {DECOR[item.kind as DecorKind]?.name ?? 'Decoración'}
            </ThemedText>
            <LightButton
              label={`Quitar (recuperas ${Math.floor((DECOR[item.kind as DecorKind]?.price ?? 0) / 2)} 🪙)`}
              onPress={() => removeItem(item)}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        ) : null}
      </Sheet>

      {/* Cómo funciona */}
      <Sheet visible={info} title="Cómo funciona" onClose={() => setInfo(false)}>
        <ScrollView>
          <ThemedText size={14} style={{ lineHeight: 21 }}>
            {`• Cada juego que terminas levanta un edificio. Cuantas más horas, más alto.\n• Los juegos de la misma saga forman un barrio del mismo color. Los completados al 100 % son dorados.\n• Lo que estás jugando aparece en obras, con grúa.\n• Cada hora jugada son ${COINS_PER_HOUR} monedas (las horas que apuntas o, si terminaste el juego, lo que dura). Llevas ${fmt(earned)} ganadas y ${fmt(city.spent)} gastadas.\n• Con las monedas mejoras edificios (ventanas encendidas, antena y corona dorada), pones decoración, cambias el cielo y amplías el terreno.\n• Arrastra para moverte y pellizca (o usa + y −) para hacer zoom. Tu mundo se guarda en tu cuenta.`}
          </ThemedText>
        </ScrollView>
      </Sheet>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const c = useIgnColors();
  return (
    <View style={[styles.stat, { backgroundColor: c.card, borderRadius: c.radius, borderColor: c.line }]}>
      <ThemedText variant="display" size={17} numberOfLines={1}>
        {value}
      </ThemedText>
      <ThemedText variant="muted" size={11}>
        {label}
      </ThemedText>
    </View>
  );
}

function ZoomButton({ icon, onPress }: { icon: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.zoomBtn} hitSlop={4}>
      <Ionicons name={icon as never} size={20} color="#111" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth },
  zoom: { position: 'absolute', right: 10, top: 10, gap: 8 },
  zoomBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffffe6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placing: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  bar: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingTop: 12 },
  tabs: { flexDirection: 'row', padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  shopItem: { width: '31%', alignItems: 'center', paddingVertical: 10, gap: 2 },
  skyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1.5 },
  skySwatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 4 },
});
