// Los menús de un juego (como en IGN): Editar estado, "•••" y Organizar en listas.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { PLATFORMS, STATUS_CHOICES, STATUS_META } from '@/data/meta';
import { useListPreview, useMyLists } from '@/hooks/useLists';
import { useStore } from '@/store/useStore';
import type { GameRecord, PlayStatus } from '@/types';
import { itemsOfList, userGameKey } from '@/utils/library';
import { notify } from '@/utils/notify';

import { celebrate } from './Celebration';
import { PlayDetails } from './details';
import { Mosaic, Sheet, SheetRow, StatusIcon, useIgnColors } from './ign';
import { ThemedText } from './ThemedText';

type Kind = 'status' | 'more' | 'organize' | 'platform';

// Guarda el juego en el móvil si venía de la API y aún no estaba.
function useEnsureGame() {
  const upsertGame = useStore((s) => s.upsertGame);
  return useCallback(
    (game: GameRecord) => {
      if (!useStore.getState().games[game.id]) upsertGame(game);
    },
    [upsertGame],
  );
}

export function useGameSheets() {
  const [state, setState] = useState<{ game: GameRecord; kind: Kind } | null>(null);
  const open = useCallback((kind: Kind) => (game: GameRecord) => setState({ game, kind }), []);
  const close = useCallback(() => setState(null), []);
  const element = state ? (
    <GameSheetsHost
      game={state.game}
      kind={state.kind}
      onKind={(kind) => setState({ game: state.game, kind })}
      onClose={close}
    />
  ) : null;
  return {
    openStatus: open('status'),
    openMore: open('more'),
    openOrganize: open('organize'),
    element,
  };
}

function GameSheetsHost({
  game,
  kind,
  onKind,
  onClose,
}: {
  game: GameRecord;
  kind: Kind;
  onKind: (kind: Kind) => void;
  onClose: () => void;
}) {
  if (kind === 'status') return <StatusSheet game={game} onClose={onClose} />;
  if (kind === 'organize') return <OrganizeSheet game={game} onClose={onClose} />;
  if (kind === 'platform') return <PlatformSheet game={game} onClose={onClose} />;
  return <MoreSheet game={game} onClose={onClose} onKind={onKind} />;
}

// ---------- Editar estado ----------

function StatusSheet({ game, onClose }: { game: GameRecord; onClose: () => void }) {
  const c = useIgnColors();
  const profileId = useStore((s) => s.currentProfileId);
  const userGames = useStore((s) => s.userGames);
  const setStatus = useStore((s) => s.setStatus);
  const removeFromLibrary = useStore((s) => s.removeFromLibrary);
  const ensure = useEnsureGame();
  const current = profileId ? userGames[userGameKey(profileId, game.id)] : undefined;

  const counts = useMemo(() => {
    const out: Partial<Record<PlayStatus, number>> = {};
    for (const ug of Object.values(userGames)) {
      if (ug.profileId !== profileId) continue;
      const s = ug.status === 'completed' ? 'beaten' : ug.status;
      out[s] = (out[s] ?? 0) + 1;
    }
    out.library = Object.values(userGames).filter((u) => u.profileId === profileId).length;
    return out;
  }, [userGames, profileId]);

  const choose = (status: PlayStatus) => {
    ensure(game);
    const wasFinished = current?.status === 'beaten' || current?.status === 'completed';
    setStatus(game.id, status);
    if (!wasFinished && (status === 'beaten' || status === 'completed')) {
      // Cerramos el menú para que se vea la celebración.
      onClose();
      celebrate({ kind: 'finish', title: game.title });
    }
    notify(`${game.title}: ${STATUS_META[status].short}`);
  };
  const currentStatus = current?.status === 'completed' ? 'beaten' : current?.status;

  return (
    <Sheet visible title={game.title} onClose={onClose}>
      {STATUS_CHOICES.map((status, i) => (
        <SheetRow
          key={status}
          label={STATUS_META[status].label}
          left={<StatusIcon status={status} size={30} />}
          right={
            <View style={styles.rowRight}>
              <ThemedText variant="muted" size={13}>
                {counts[status] ?? 0}
              </ThemedText>
              {currentStatus === status ? <Ionicons name="checkmark-circle" size={22} color={c.text} /> : null}
            </View>
          }
          selected={currentStatus === status}
          onPress={() => choose(status)}
          last={i === STATUS_CHOICES.length - 1}
        />
      ))}
      {current ? (
        <Pressable
          onPress={() => {
            removeFromLibrary(game.id);
            notify('Quitado de tu biblioteca');
            onClose();
          }}
          style={styles.remove}
        >
          <Ionicons name="trash-outline" size={18} color="#e5484d" />
          <ThemedText variant="bold" size={14} style={{ color: '#e5484d' }}>
            Quitar de la biblioteca
          </ThemedText>
        </Pressable>
      ) : null}
      {current ? (
        <>
          <View style={[styles.divider, { backgroundColor: c.line }]} />
          <ThemedText variant="display" size={17} style={{ marginBottom: 10 }}>
            Tu partida
          </ThemedText>
          <PlayDetails game={game} />
        </>
      ) : null}
      <View style={[styles.divider, { backgroundColor: c.line }]} />
      <OrganizeRows game={game} onClose={onClose} />
    </Sheet>
  );
}

// ---------- "•••" ----------

const QUICK: PlayStatus[] = ['playing', 'dropped', 'backlog'];

function MoreSheet({ game, onClose, onKind }: { game: GameRecord; onClose: () => void; onKind: (kind: Kind) => void }) {
  const c = useIgnColors();
  const setStatus = useStore((s) => s.setStatus);
  const ensure = useEnsureGame();
  const profileId = useStore((s) => s.currentProfileId);
  const current = useStore((s) => (profileId ? s.userGames[userGameKey(profileId, game.id)] : undefined));

  const go = (path: string) => {
    ensure(game);
    onClose();
    router.push(path as never);
  };

  return (
    <Sheet visible title={game.title} onClose={onClose}>
      <SheetRow
        label="Organizar en listas"
        right={<Ionicons name="add-circle-outline" size={24} color={c.text} />}
        onPress={() => onKind('organize')}
      />
      <SheetRow
        label="Plataforma en la que juegas"
        caption={current?.platform ? current.platform.toUpperCase() : undefined}
        right={<Ionicons name="game-controller-outline" size={22} color={c.text} />}
        onPress={() => onKind('platform')}
      />
      <SheetRow
        label={current?.rating ? 'Editar tu reseña' : 'Valorar y reseñar'}
        right={<Ionicons name="star-outline" size={22} color={c.text} />}
        onPress={() => go(`/game/${encodeURIComponent(game.id)}/review`)}
      />
      <SheetRow
        label="Más detalles (horas, fechas…)"
        right={<Ionicons name="create-outline" size={22} color={c.text} />}
        onPress={() => go(`/game/${encodeURIComponent(game.id)}/edit`)}
      />
      <SheetRow
        label="Recomendar a un amigo"
        right={<Ionicons name="paper-plane-outline" size={22} color={c.text} />}
        onPress={() => go(`/share-game?gameId=${encodeURIComponent(game.id)}`)}
      />
      <SheetRow
        label="Compartir juego"
        right={<Ionicons name="share-outline" size={22} color={c.text} />}
        onPress={() => {
          Share.share({
            message: `${game.title}${game.year ? ` (${game.year})` : ''} — en mi biblioteca de Saga Quest 🎮`,
          }).catch(() => undefined);
        }}
        last
      />
      <View style={styles.quickRow}>
        {QUICK.map((status) => (
          <Pressable
            key={status}
            onPress={() => {
              ensure(game);
              setStatus(game.id, status);
              notify(`${game.title}: ${STATUS_META[status].short}`);
              onClose();
            }}
            style={[styles.quick, { backgroundColor: c.soft, borderRadius: c.radius }]}
          >
            <StatusIcon status={status} size={28} />
            <ThemedText size={11} numberOfLines={1}>
              {STATUS_META[status].short}
            </ThemedText>
          </Pressable>
        ))}
        <Pressable
          onPress={() => onKind('status')}
          style={[styles.quick, { backgroundColor: c.soft, borderRadius: c.radius }]}
        >
          <View style={[styles.moreIcon, { backgroundColor: c.inverseBg }]}>
            <Ionicons name="ellipsis-horizontal" size={16} color={c.inverseText} />
          </View>
          <ThemedText size={11}>Más…</ThemedText>
        </Pressable>
      </View>
    </Sheet>
  );
}

// ---------- Organizar en listas ----------

function OrganizeSheet({ game, onClose }: { game: GameRecord; onClose: () => void }) {
  return (
    <Sheet visible title={game.title} onClose={onClose}>
      <OrganizeRows game={game} onClose={onClose} />
    </Sheet>
  );
}

// Tus listas con un botón para meter o sacar el juego (sirve en las dos hojas).
function OrganizeRows({ game, onClose }: { game: GameRecord; onClose: () => void }) {
  const c = useIgnColors();
  const lists = useMyLists();
  const preview = useListPreview();
  const items = useStore((s) => s.items);
  const addToList = useStore((s) => s.addToList);
  const removeFromList = useStore((s) => s.removeFromList);
  const ensure = useEnsureGame();

  return (
    <>
      <ThemedText variant="bold" size={11} style={styles.overline}>
        ORGANIZAR EN TUS LISTAS
      </ThemedText>
      <SheetRow
        label="Nueva lista"
        caption="CREAR UNA CON ESTE JUEGO"
        left={
          <View style={[styles.newThumb, { backgroundColor: c.accent, borderRadius: 6 }]}>
            <Ionicons name="albums" size={18} color="#fff" />
          </View>
        }
        right={<Ionicons name="add-circle-outline" size={26} color={c.text} />}
        onPress={() => {
          ensure(game);
          onClose();
          router.push(`/list/edit?addGame=${encodeURIComponent(game.id)}` as never);
        }}
      />
      {lists.map((list, i) => {
        const listItems = itemsOfList(items, list.id);
        const inList = listItems.some((it) => it.gameId === game.id);
        return (
          <SheetRow
            key={list.id}
            label={list.name}
            caption={`${listItems.length} ${listItems.length === 1 ? 'JUEGO' : 'JUEGOS'}${inList ? ' · ESTÁ AQUÍ' : ''}`}
            left={<Mosaic list={list} games={preview(list.id)} size={44} radius={6} />}
            right={
              <View style={styles.rowRight}>
                {list.visibility === 'private' ? <Ionicons name="lock-closed" size={14} color={c.muted} /> : null}
                <Ionicons
                  name={inList ? 'checkmark-circle' : 'add-circle-outline'}
                  size={26}
                  color={inList ? c.accent : c.text}
                />
              </View>
            }
            onPress={() => {
              ensure(game);
              if (inList) {
                removeFromList(list.id, game.id);
                notify(`Quitado de ${list.name}`);
              } else {
                addToList(list.id, game.id);
                notify(`Añadido a ${list.name}`);
              }
            }}
            last={i === lists.length - 1}
          />
        );
      })}
    </>
  );
}

// ---------- Plataforma ----------

function PlatformSheet({ game, onClose }: { game: GameRecord; onClose: () => void }) {
  const c = useIgnColors();
  const profileId = useStore((s) => s.currentProfileId);
  const current = useStore((s) => (profileId ? s.userGames[userGameKey(profileId, game.id)] : undefined));
  const updateUserGame = useStore((s) => s.updateUserGame);
  const ensure = useEnsureGame();
  const released = game.platforms
    .split(/,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const options = [...new Set([...released, ...PLATFORMS])];
  return (
    <Sheet visible title="¿En qué plataforma juegas?" onClose={onClose}>
      {options.map((p, i) => (
        <SheetRow
          key={p}
          label={p}
          caption={released.includes(p) ? 'SALIÓ EN ESTA PLATAFORMA' : undefined}
          selected={current?.platform === p}
          right={
            <Ionicons
              name={current?.platform === p ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={c.text}
            />
          }
          onPress={() => {
            ensure(game);
            updateUserGame(game.id, { platform: current?.platform === p ? null : p });
          }}
          last={i === options.length - 1}
        />
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  remove: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  quick: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12 },
  moreIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  overline: { letterSpacing: 1.2, marginBottom: 4, opacity: 0.8 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  newThumb: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
