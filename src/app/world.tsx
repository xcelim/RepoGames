// Mundo gamer: tu pueblo medieval a píxeles. Empiezas con un terreno y un ayuntamiento;
// talas árboles, construyes edificios separados, compras aldeanos que trabajan y produces recursos.
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { DarkButton, LightButton, Sheet, useIgnColors } from '@/components/ign';
import { PixelSprite } from '@/components/PixelSprite';
import { ScreenHeader } from '@/components/lists';
import { type Cell, type Mode, ProductionBars, WorldMap, spriteOf } from '@/components/WorldMap';
import { ThemedText } from '@/components/ThemedText';
import { useMyGames } from '@/hooks/useMyGames';
import { useCurrentProfile, useStore } from '@/store/useStore';
import type { CityBuilding, CityState, Res } from '@/types';
import {
  addDecor,
  advance,
  assign,
  available,
  BUILDINGS,
  BUILDING_KINDS,
  buildingAt,
  buyVillager,
  canAfford,
  chop,
  build,
  type Cost,
  cityOf,
  DECOR,
  decorAt,
  demolish,
  EXPAND_COST,
  expand,
  freeVillagers,
  hasTree,
  housingCapacity,
  MAX_SIZE,
  newCity,
  productionText,
  RES,
  removeDecor,
  requirementMet,
  requirementText,
  type Result,
  sourcesOf,
  type Stock,
  upgrade,
  VILLAGER_COST,
  workersTotal,
} from '@/utils/world';
import { type SpriteName } from '@/utils/sprites';
import { notify } from '@/utils/notify';

const costText = (cost: Cost) =>
  Object.entries(cost)
    .filter(([, v]) => v)
    .map(([r, v]) => `${v} ${RES[r as Res].name.toLowerCase()}`)
    .join(' · ') || 'Gratis';

const fmt = (n: number) => Math.floor(n).toLocaleString('es-ES');
const buzz = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
};

type SheetKind = { type: 'build' } | { type: 'building'; id: string } | { type: 'villagers' } | { type: 'info' } | null;

export default function WorldScreen() {
  const c = useIgnColors();
  const { width: winW } = useWindowDimensions();
  const mine = useMyGames();
  const profile = useCurrentProfile();
  const updateProfile = useStore((s) => s.updateProfile);
  const src: Stock = useMemo(() => sourcesOf(mine), [mine]);

  // Tu mundo guardado en el perfil es la fuente de verdad. Lo que se ve se calcula desde ahí
  // con el reloj de cada segundo, así que la producción nunca se cuenta dos veces.
  const saved = cityOf(profile?.city);
  const [now, setNow] = useState(() => Date.now());
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [tab, setTab] = useState<'edificios' | 'decoracion'>('edificios');
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [selected, setSelected] = useState<Cell | null>(null);
  const live = useMemo(() => (saved ? advance(saved, src, now) : null), [saved, src, now]);

  // Para el guardado periódico (que no debe quedarse con valores viejos).
  const savedRef = useRef(saved);
  const srcRef = useRef(src);
  useEffect(() => {
    savedRef.current = saved;
    srcRef.current = src;
  });

  // Guarda el mundo en tu perfil (la nube). Cada acción guarda; además cada 30 s por la producción.
  const commit = (next: CityState) => updateProfile({ city: next });

  // Primera vez (o versión antigua del mundo): empiezas de cero con un terreno nuevo.
  useEffect(() => {
    if (profile && !cityOf(profile.city)) updateProfile({ city: newCity() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.city]);

  // Reloj: la producción avanza cada segundo.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Guardado periódico: fija la producción en tu perfil.
  useEffect(() => {
    const flush = () => {
      const s0 = savedRef.current;
      if (s0) commit(advance(s0, srcRef.current, Date.now()));
    };
    const t = setInterval(flush, 30_000);
    return () => {
      clearInterval(t);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aplica una acción sobre el mundo ya avanzado hasta ahora.
  const act = (fn: (st: CityState) => Result, done?: string): boolean => {
    if (!saved) return false;
    const r = fn(advance(saved, src, now));
    if (!r.ok) {
      notify(r.error);
      return false;
    }
    buzz();
    commit(r.state);
    if (done) notify(done);
    return true;
  };

  // El mapa solo se vuelve a dibujar si cambia lo que se ve (no con cada segundo).
  const shapeKey = live
    ? `${live.size}|${live.seed}|${live.chopped.length}|${live.buildings
        .map((b) => `${b.id}:${b.kind}:${b.level}:${b.x},${b.y}:${b.workers}`)
        .join(';')}|${live.items.map((i) => i.id).join(';')}`
    : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shape = useMemo(() => live, [shapeKey]);

  if (!live || !shape) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <ScreenHeader back title="Mundo gamer" />
      </View>
    );
  }

  const st = live;
  // Nunca se enseña menos de 0 (si borras juegos, el oro de tus horas puede bajar).
  const have = (r: Res) => Math.max(0, available(st, src, r));
  const cap = housingCapacity(st);
  const free = freeVillagers(st);
  const width = Math.min(winW - 24, 560);

  const onCell = (x: number, y: number) => {
    if (mode.kind === 'build') {
      act((s) => build(s, src, mode.building, x, y), `🏗️ ${BUILDINGS[mode.building].name} construido`);
      return;
    }
    if (mode.kind === 'decor') {
      act((s) => addDecor(s, src, mode.item, x, y), `${DECOR[mode.item].name} colocado`);
      return;
    }
    setSelected({ x, y });
    if (hasTree(st, x, y)) return act((s) => chop(s, x, y), '🪓 +2 de madera');
    const b = buildingAt(st, x, y);
    if (b) return setSheet({ type: 'building', id: b.id });
    const d = decorAt(st, x, y);
    if (d) {
      Alert.alert(`¿Quitar ${DECOR[d.kind]?.name.toLowerCase() ?? 'esto'}?`, 'Recuperas la mitad de lo que costó.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Quitar', style: 'destructive', onPress: () => act((s) => ({ ok: true, state: removeDecor(s, d.id) })) },
      ]);
    }
  };

  const expandAsk = () => {
    if (st.size >= MAX_SIZE) return notify('Tu terreno ya está al máximo');
    const cost = EXPAND_COST[st.size];
    if (!cost) return notify('No se puede ampliar más');
    Alert.alert(`Ampliar a ${st.size + 2}×${st.size + 2}`, `Cuesta ${costText(cost)}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Ampliar', onPress: () => act((s) => expand(s, src), 'Terreno ampliado') },
    ]);
  };

  const demolishAsk = (b: CityBuilding) => {
    Alert.alert(`¿Derribar ${BUILDINGS[b.kind].name.toLowerCase()}?`, 'Recuperas la mitad de lo que costó.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Derribar',
        style: 'destructive',
        onPress: () => {
          setSheet(null);
          act((s) => demolish(s, b.id), 'Derribado');
        },
      },
    ]);
  };

  const selectedBuilding = sheet?.type === 'building' ? st.buildings.find((b) => b.id === sheet.id) : undefined;

  const pickBuilding = (kind: string) => {
    setSheet(null);
    setMode({ kind: 'build', building: kind });
    notify(`Toca una casilla libre para ${BUILDINGS[kind].name.toLowerCase()}`);
  };
  const pickDecor = (kind: string) => {
    setSheet(null);
    setMode({ kind: 'decor', item: kind });
    notify(`Toca una casilla libre para ${DECOR[kind].name.toLowerCase()}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader
        back
        title="Mundo gamer"
        right={
          <Pressable onPress={() => setSheet({ type: 'info' })} hitSlop={8} accessibilityLabel="Cómo funciona">
            <Ionicons name="information-circle-outline" size={24} color={c.text} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.resources}>
          <ResPill icon="coin" value={fmt(have('gold'))} />
          <ResPill icon="log" value={fmt(have('wood'))} />
          <ResPill icon="gem" value={fmt(have('diamonds'))} />
          <Pressable onPress={() => setSheet({ type: 'villagers' })} style={styles.res}>
            <PixelSprite name="villager" size={20} />
            <ThemedText variant="bold" size={13}>{`${st.villagers}/${cap}`}</ThemedText>
          </Pressable>
        </View>

        <View style={[styles.frame, { borderColor: c.line, backgroundColor: '#3d7430' }]}>
          <View style={{ width, height: width }}>
            <WorldMap st={shape} width={width} mode={mode} selected={selected} onCell={onCell} />
            <ProductionBars st={st} width={width} />
          </View>
        </View>

        {mode.kind !== 'idle' ? (
          <View style={[styles.hint, { backgroundColor: c.inverseBg, borderRadius: c.radius }]}>
            <ThemedText variant="bold" size={14} style={{ color: c.inverseText, flex: 1 }}>
              {mode.kind === 'build'
                ? `Construir: ${BUILDINGS[mode.building].name} — toca una casilla verde`
                : `Decorar: ${DECOR[mode.item].name} — toca una casilla verde`}
            </ThemedText>
            <Pressable onPress={() => setMode({ kind: 'idle' })} hitSlop={8}>
              <ThemedText variant="bold" size={14} style={{ color: c.inverseText }}>
                Cancelar
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <ThemedText variant="muted" size={12} style={{ textAlign: 'center' }}>
            Toca un árbol para talarlo · un edificio para gestionarlo · una casilla libre para ver qué puedes poner
          </ThemedText>
        )}

        <View style={styles.actions}>
          <LightButton label="Construir" icon="hammer" onPress={() => setSheet({ type: 'build' })} style={{ flex: 1 }} />
          <LightButton label="Aldeanos" icon="people" onPress={() => setSheet({ type: 'villagers' })} style={{ flex: 1 }} />
          <LightButton label="Ampliar" icon="expand" onPress={expandAsk} style={{ flex: 1 }} />
        </View>
        <ThemedText variant="muted" size={11} style={{ textAlign: 'center' }}>
          {`Terreno ${st.size}×${st.size} · ${st.buildings.length} edificios · ${free} aldeanos libres`}
        </ThemedText>
      </ScrollView>

      {/* Construir: edificios y decoración. */}
      <Sheet
        visible={sheet?.type === 'build'}
        title="Construir"
        onClose={() => setSheet(null)}
        doneLabel="Cerrar"
      >
        <View style={styles.tabs}>
          {(['edificios', 'decoracion'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, { backgroundColor: tab === t ? c.inverseBg : c.soft, borderRadius: c.radius }]}
            >
              <ThemedText variant="bold" size={13} style={{ color: tab === t ? c.inverseText : c.text }}>
                {t === 'edificios' ? 'Edificios' : 'Decoración'}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        {tab === 'edificios'
          ? BUILDING_KINDS.filter((k) => !BUILDINGS[k].hall).map((k, i, arr) => {
              const def = BUILDINGS[k];
              const have = st.buildings.some((b) => b.kind === k);
              const locked = def.requires && !requirementMet(st, def.requires);
              const affordable = canAfford(st, src, def.cost);
              const note = have && def.unique
                ? 'Ya lo tienes'
                : locked
                  ? `Antes: ${requirementText(def.requires!)}`
                  : !affordable
                    ? `Te faltan recursos · ${costText(def.cost)}`
                    : costText(def.cost);
              return (
                <BuildRow
                  key={k}
                  name={def.name}
                  note={note}
                  detail={productionText(k)}
                  sprite={spriteOf({ kind: k, level: 1 } as CityBuilding)}
                  dim={!!(locked || (have && def.unique) || !affordable)}
                  last={i === arr.length - 1}
                  onPress={() => {
                    if (have && def.unique) return notify(`Ya tienes un ${def.name.toLowerCase()}`);
                    if (locked) return notify(note);
                    pickBuilding(k);
                  }}
                />
              );
            })
          : Object.keys(DECOR).map((k, i, arr) => (
              <BuildRow
                key={k}
                name={DECOR[k].name}
                note={costText(DECOR[k].cost)}
                sprite={k as SpriteName}
                dim={!canAfford(st, src, DECOR[k].cost)}
                last={i === arr.length - 1}
                onPress={() => pickDecor(k)}
              />
            ))}
      </Sheet>

      {/* Un edificio: aldeanos, mejora y derribo. */}
      <Sheet
        visible={!!selectedBuilding}
        title={selectedBuilding ? BUILDINGS[selectedBuilding.kind].name : ''}
        onClose={() => setSheet(null)}
        doneLabel="Cerrar"
      >
        {selectedBuilding ? (
          <BuildingDetail
            b={selectedBuilding}
            st={st}
            src={src}
            free={free}
            onWorkers={(d) => act((s) => assign(s, selectedBuilding.id, d))}
            onUpgrade={() => act((s) => upgrade(s, src, selectedBuilding.id), 'Mejorado')}
            onDemolish={() => demolishAsk(selectedBuilding)}
          />
        ) : null}
      </Sheet>

      {/* Aldeanos: cuántos caben, cuántos trabajan y comprar más. */}
      <Sheet visible={sheet?.type === 'villagers'} title="Aldeanos" onClose={() => setSheet(null)} doneLabel="Cerrar">
        <View style={{ gap: 12 }}>
          <ThemedText variant="muted" size={14}>
            {`Tienes ${st.villagers} aldeanos (caben ${cap}). Trabajando: ${workersTotal(st)}. Libres: ${free}.`}
          </ThemedText>
          <ThemedText variant="muted" size={13}>
            Cada aldeano trabaja en un edificio de producción (serrería, mina, joyería). Construye o mejora chozas para tener sitio.
          </ThemedText>
          <DarkButton
            label={`Comprar aldeano · ${VILLAGER_COST} oro`}
            icon="person-add"
            disabled={!canAfford(st, src, { gold: VILLAGER_COST })}
            onPress={() => act((s) => buyVillager(s, src), 'Ha llegado un aldeano')}
          />
        </View>
      </Sheet>

      {/* Cómo funciona. */}
      <Sheet visible={sheet?.type === 'info'} title="Cómo funciona" onClose={() => setSheet(null)} doneLabel="Entendido">
        <View style={{ gap: 10 }}>
          <ThemedText size={14}>
            🪙 <ThemedText variant="bold" size={14}>Oro:</ThemedText> 10 por cada hora que juegas.
          </ThemedText>
          <ThemedText size={14}>
            🪵 <ThemedText variant="bold" size={14}>Madera:</ThemedText> 1 por cada logro suelto (los de un platino no cuentan) y 2 por cada árbol talado.
          </ThemedText>
          <ThemedText size={14}>
            💎 <ThemedText variant="bold" size={14}>Diamantes:</ThemedText> 1 por cada platino.
          </ThemedText>
          <ThemedText variant="muted" size={13}>
            Tus aldeanos producen mientras no estás, hasta 12 h. Ampliar el terreno y los edificios cuestan recursos; derribar devuelve la mitad.
          </ThemedText>
        </View>
      </Sheet>
    </View>
  );
}

// Fila de la hoja de construir: nombre, coste/estado y, debajo, lo que produce.
function BuildRow({
  name,
  note,
  detail,
  sprite,
  dim,
  last,
  onPress,
}: {
  name: string;
  note: string;
  detail?: string | null;
  sprite: SpriteName;
  dim?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  const c = useIgnColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.buildRow,
        { borderBottomColor: c.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, opacity: pressed ? 0.7 : dim ? 0.55 : 1 },
      ]}
    >
      <PixelSprite name={sprite} size={44} />
      <View style={{ flex: 1, gap: 3 }}>
        <ThemedText variant="bold" size={16}>
          {name}
        </ThemedText>
        <ThemedText variant="muted" size={13}>
          {note}
        </ThemedText>
        {detail ? (
          <ThemedText variant="muted" size={12}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

function ResPill({ icon, value }: { icon: SpriteName; value: string }) {
  return (
    <View style={styles.res}>
      <PixelSprite name={icon} size={20} />
      <ThemedText variant="bold" size={13}>
        {value}
      </ThemedText>
    </View>
  );
}

// Ficha de un edificio: producción, aldeanos (+/−), mejora y derribo.
function BuildingDetail({
  b,
  st,
  src,
  free,
  onWorkers,
  onUpgrade,
  onDemolish,
}: {
  b: CityBuilding;
  st: CityState;
  src: Stock;
  free: number;
  onWorkers: (delta: number) => void;
  onUpgrade: () => void;
  onDemolish: () => void;
}) {
  const c = useIgnColors();
  const def = BUILDINGS[b.kind];
  const prod = productionText(b.kind);
  const up = def.upgrades[b.level - 1];
  const canUp = b.level < def.maxLevel && up !== undefined;
  const pct = def.produce ? Math.min(1, b.progress / def.produce.every) : 0;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <PixelSprite name={spriteOf(b)} size={72} />
        <View style={{ flex: 1, gap: 4 }}>
          <ThemedText variant="muted" size={13}>
            {def.hall ? 'Ayuntamiento' : `Nivel ${b.level} de ${def.maxLevel}`}
          </ThemedText>
          <ThemedText size={14}>{def.desc}</ThemedText>
        </View>
      </View>

      {def.housing[b.level - 1] ? (
        <ThemedText variant="muted" size={13}>{`Aloja a ${def.housing[b.level - 1]} aldeanos.`}</ThemedText>
      ) : null}

      {def.maxWorkers ? (
        <View style={{ gap: 8 }}>
          {prod ? <ThemedText variant="muted" size={13}>{`Produce: ${prod}`}</ThemedText> : null}
          <View style={[styles.workers, { borderColor: c.line, borderRadius: c.radius }]}>
            <ThemedText variant="bold" size={14} style={{ flex: 1 }}>
              {`Aldeanos: ${b.workers}/${def.maxWorkers}`}
            </ThemedText>
            <LightButton label="−" onPress={() => onWorkers(-1)} disabled={b.workers <= 0} style={styles.step} />
            <LightButton
              label="+"
              onPress={() => onWorkers(1)}
              disabled={b.workers >= def.maxWorkers || free <= 0}
              style={styles.step}
            />
          </View>
          {b.workers > 0 && def.produce ? (
            <View style={[styles.bar, { backgroundColor: c.soft }]}>
              <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: c.accent }} />
            </View>
          ) : null}
          <ThemedText variant="muted" size={12}>{`Aldeanos libres: ${free}`}</ThemedText>
        </View>
      ) : null}

      {canUp ? (
        <DarkButton label={`Mejorar a nivel ${b.level + 1} · ${costText(up)}`} icon="arrow-up" onPress={onUpgrade} />
      ) : null}
      {!def.hall ? <LightButton label="Derribar" icon="trash" onPress={onDemolish} /> : null}
      <ThemedText variant="muted" size={11}>{`Tienes ${fmt(Math.max(0, available(st, src, 'gold')))} de oro.`}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 12, paddingBottom: 40, gap: 12, alignItems: 'center' },
  resources: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignSelf: 'stretch' },
  res: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 10 },
  frame: { borderWidth: 3, borderRadius: 6, padding: 2 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'stretch' },
  actions: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 8 },
  workers: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
  step: { minWidth: 48 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  buildRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
});
