// Fila que se desliza de lado. En el móvil, un ScrollView normal; en la web (ratón), además:
// flechas para avanzar, arrastrar con el ratón y la rueda con Mayús.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';

import { useSkin } from '@/theme/useSkin';

type Props = Omit<ScrollViewProps, 'horizontal'> & { children: ReactNode };

export function HScroll(props: Props) {
  if (Platform.OS !== 'web') return <ScrollView horizontal showsHorizontalScrollIndicator={false} {...props} />;
  return <WebHScroll {...props} />;
}

type ScrollNode = { scrollLeft: number; scrollBy: (o: { left: number; behavior: 'smooth' }) => void } & HTMLElement;

function WebHScroll({ children, onScroll, ...rest }: Props) {
  const skin = useSkin();
  const ref = useRef<ScrollView>(null);
  const [x, setX] = useState(0);
  const [content, setContent] = useState(0);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(false);
  const max = Math.max(0, content - width);

  // Arrastrar con el ratón (sin que el clic final abra lo que hay debajo).
  useEffect(() => {
    const node = (ref.current as unknown as { getScrollableNode?: () => ScrollNode } | null)?.getScrollableNode?.();
    if (!node) return;
    let startX = 0;
    let startLeft = 0;
    let down = false;
    let moved = false;
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      down = true;
      moved = false;
      startX = e.clientX;
      startLeft = node.scrollLeft;
    };
    const onMove = (e: MouseEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 5) moved = true;
      if (moved) {
        node.scrollLeft = startLeft - dx;
        node.style.cursor = 'grabbing';
        e.preventDefault();
      }
    };
    const onUp = () => {
      down = false;
      node.style.cursor = '';
    };
    const onClick = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };
    node.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    node.addEventListener('click', onClick, true);
    return () => {
      node.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      node.removeEventListener('click', onClick, true);
    };
  }, []);

  const page = (dir: 1 | -1) => {
    const node = (ref.current as unknown as { getScrollableNode?: () => ScrollNode } | null)?.getScrollableNode?.();
    node?.scrollBy({ left: dir * Math.max(200, width * 0.8), behavior: 'smooth' });
  };

  const arrow = (dir: 1 | -1) => (
    <Pressable
      onPress={() => page(dir)}
      accessibilityLabel={dir > 0 ? 'Siguiente' : 'Anterior'}
      style={[
        styles.arrow,
        dir > 0 ? { right: 6 } : { left: 6 },
        { backgroundColor: skin.colors.panel, borderColor: skin.colors.line },
      ]}
    >
      <Ionicons name={dir > 0 ? 'chevron-forward' : 'chevron-back'} size={22} color={skin.colors.text} />
    </Pressable>
  );

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...({ onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) } as object)}
    >
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onContentSizeChange={(w) => setContent(w)}
        onScroll={(e) => {
          setX(e.nativeEvent.contentOffset.x);
          onScroll?.(e);
        }}
        {...rest}
      >
        {children}
      </ScrollView>
      {hover && x > 4 ? arrow(-1) : null}
      {hover && x < max - 4 ? arrow(1) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    zIndex: 5,
  },
});
