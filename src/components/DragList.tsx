// Lista que se reordena arrastrando el asa "⁞⁞" (como "Edit playlist" en IGN).
import { type ReactNode, useLayoutEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useScrollViewOffset,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedScroll = Animated.createAnimatedComponent(GHScrollView);

type Props<T> = {
  data: T[];
  keyOf: (item: T) => string;
  rowHeight: number;
  renderRow: (item: T, index: number, handle: ReactNode) => ReactNode;
  renderHandle: () => ReactNode;
  onMove: (from: number, to: number) => void;
  header?: ReactNode;
  footer?: ReactNode;
  contentPaddingBottom?: number;
};

export function DragList<T>({
  data,
  keyOf,
  rowHeight,
  renderRow,
  renderHandle,
  onMove,
  header,
  footer,
  contentPaddingBottom = 60,
}: Props<T>) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef as never);
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const active = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const fingerY = useSharedValue(0);
  const count = useSharedValue(data.length);
  const [dragging, setDragging] = useState(false);
  const signature = data.map(keyOf).join('|');

  useLayoutEffect(() => {
    count.set(data.length);
    // El nuevo orden ya está pintado: se quitan los desplazamientos sin animar.
    active.set(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const hover = useDerivedValue(() => {
    if (active.value < 0) return -1;
    const offset = dragY.value + (scrollY.value - startScroll.value);
    const target = Math.round(active.value + offset / rowHeight);
    return Math.max(0, Math.min(count.value - 1, target));
  });

  // Desplazamiento automático al acercar el dedo a los bordes.
  useFrameCallback(() => {
    if (active.value < 0) return;
    const top = insets.top + 90;
    const bottom = winH - insets.bottom - 90;
    if (fingerY.value < top) scrollTo(scrollRef, 0, Math.max(0, scrollY.value - 9), false);
    else if (fingerY.value > bottom) scrollTo(scrollRef, 0, scrollY.value + 9, false);
  });

  const finish = (from: number, to: number) => {
    setDragging(false);
    if (from !== to) onMove(from, to);
    else active.set(-1);
  };

  return (
    <AnimatedScroll
      ref={scrollRef}
      scrollEnabled={!dragging}
      contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
      keyboardShouldPersistTaps="handled"
    >
      {header}
      <View style={{ height: data.length * rowHeight }}>
        {data.map((item, index) => (
          <Row
            key={keyOf(item)}
            index={index}
            rowHeight={rowHeight}
            active={active}
            hover={hover}
            dragY={dragY}
            scrollY={scrollY}
            startScroll={startScroll}
            fingerY={fingerY}
            onStart={() => setDragging(true)}
            onEnd={finish}
            render={(handle) => renderRow(item, index, handle)}
            handle={renderHandle()}
          />
        ))}
      </View>
      {footer}
    </AnimatedScroll>
  );
}

type Shared = ReturnType<typeof useSharedValue<number>>;

function Row({
  index,
  rowHeight,
  active,
  hover,
  dragY,
  scrollY,
  startScroll,
  fingerY,
  onStart,
  onEnd,
  render,
  handle,
}: {
  index: number;
  rowHeight: number;
  active: Shared;
  hover: { value: number };
  dragY: Shared;
  scrollY: { value: number };
  startScroll: Shared;
  fingerY: Shared;
  onStart: () => void;
  onEnd: (from: number, to: number) => void;
  render: (handle: ReactNode) => ReactNode;
  handle: ReactNode;
}) {
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      active.set(index);
      dragY.set(0);
      startScroll.set(scrollY.value);
      fingerY.set(e.absoluteY);
      runOnJS(onStart)();
    })
    .onUpdate((e) => {
      dragY.set(e.translationY);
      fingerY.set(e.absoluteY);
    })
    .onFinalize(() => {
      if (active.value !== index) return;
      const to = hover.value < 0 ? index : hover.value;
      // Deja la fila en su hueco final mientras la app guarda el nuevo orden.
      dragY.set((to - index) * rowHeight - (scrollY.value - startScroll.value));
      runOnJS(onEnd)(index, to);
    });

  const style = useAnimatedStyle(() => {
    const a = active.value;
    if (a < 0) return { transform: [{ translateY: 0 }, { scale: 1 }], zIndex: 0, shadowOpacity: 0, elevation: 0 };
    if (a === index) {
      return {
        transform: [{ translateY: dragY.value + (scrollY.value - startScroll.value) }, { scale: 1.03 }],
        zIndex: 10,
        shadowOpacity: 0.25,
        elevation: 8,
      };
    }
    const h = hover.value;
    let shift = 0;
    if (a < index && index <= h) shift = -rowHeight;
    else if (h <= index && index < a) shift = rowHeight;
    return {
      transform: [{ translateY: withTiming(shift, { duration: 140 }) }, { scale: 1 }],
      zIndex: 0,
      shadowOpacity: 0,
      elevation: 0,
    };
  });

  return (
    <Animated.View style={[styles.row, { top: index * rowHeight, height: rowHeight }, style]}>
      {render(
        <GestureDetector gesture={pan}>
          <View style={styles.handle} hitSlop={10}>
            {handle}
          </View>
        </GestureDetector>,
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  handle: { paddingHorizontal: 8, paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
});
