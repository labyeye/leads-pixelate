import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Linking,
  Modal,
  PanResponder,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';

const MIN = 1;
const MAX = 5;
const { width: W, height: H } = Dimensions.get('window');

const dist = (t: any[]) =>
  Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);

// Full-screen creative viewer: pinch to zoom, drag to pan, double-tap to zoom in/out, swipe arrows for carousels.
// Built on PanResponder so it needs no extra native library.
function ZoomImage({ uri }: { uri: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const cur = useRef({ s: 1, x: 0, y: 0 });
  const start = useRef({ s: 1, x: 0, y: 0, d: 0 });
  const lastTap = useRef(0);

  const apply = (s: number, x: number, y: number, animate = false) => {
    // Keep the picture from being dragged completely off screen.
    const maxX = (W * (s - 1)) / 2;
    const maxY = (H * (s - 1)) / 2;
    const cx = Math.max(-maxX, Math.min(maxX, x));
    const cy = Math.max(-maxY, Math.min(maxY, y));
    cur.current = { s, x: cx, y: cy };
    if (animate) {
      Animated.parallel([
        Animated.timing(scale, { toValue: s, duration: 160, useNativeDriver: true }),
        Animated.timing(tx, { toValue: cx, duration: 160, useNativeDriver: true }),
        Animated.timing(ty, { toValue: cy, duration: 160, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(s);
      tx.setValue(cx);
      ty.setValue(cy);
    }
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: e => {
          start.current = { ...cur.current, d: 0 };
          const now = Date.now();
          if (e.nativeEvent.touches.length === 1) {
            if (now - lastTap.current < 280) {
              cur.current.s > 1 ? apply(1, 0, 0, true) : apply(2.5, 0, 0, true);
              lastTap.current = 0;
            } else lastTap.current = now;
          }
        },
        onPanResponderMove: (e, g) => {
          const t = e.nativeEvent.touches;
          if (t.length >= 2) {
            const d = dist(t as any);
            if (!start.current.d) start.current.d = d;
            const s = Math.max(MIN, Math.min(MAX, (start.current.s * d) / start.current.d));
            apply(s, cur.current.x, cur.current.y);
          } else if (cur.current.s > 1) {
            apply(cur.current.s, start.current.x + g.dx, start.current.y + g.dy);
          }
        },
        onPanResponderRelease: () => {
          if (cur.current.s < 1.02) apply(1, 0, 0, true);
          start.current.d = 0;
        },
        onPanResponderTerminationRequest: () => false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => apply(1, 0, 0), [uri]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.stage} {...pan.panHandlers}>
      <Animated.Image
        source={{ uri }}
        resizeMode="contain"
        style={[
          styles.img,
          { transform: [{ translateX: tx }, { translateY: ty }, { scale }] },
        ]}
      />
    </View>
  );
}

export default function ImageZoomModal({
  visible,
  urls,
  index = 0,
  videoUrl,
  onClose,
}: {
  visible: boolean;
  urls: string[];
  index?: number;
  videoUrl?: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(index);
  useEffect(() => setI(index), [index, visible]);
  const list = urls.filter(Boolean);
  const uri = list[Math.min(i, list.length - 1)];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        {uri ? (
          <ZoomImage uri={uri} />
        ) : videoUrl ? (
          <View style={styles.center}>
            <Icon name="videocam-outline" size={48} color="#fff" />
            <TouchableOpacity style={styles.openBtn} onPress={() => Linking.openURL(videoUrl)}>
              <Text style={styles.openText}>Play video</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.count}>
            {list.length > 1 ? `${i + 1} / ${list.length}` : 'Pinch or double-tap to zoom'}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Icon name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {list.length > 1 && (
          <View style={[styles.nav, { bottom: insets.bottom + 24 }]}>
            <TouchableOpacity
              style={[styles.navBtn, i === 0 && { opacity: 0.3 }]}
              disabled={i === 0}
              onPress={() => setI(i - 1)}
            >
              <Icon name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navBtn, i === list.length - 1 && { opacity: 0.3 }]}
              disabled={i === list.length - 1}
              onPress={() => setI(i + 1)}
            >
              <Icon name="chevron-forward" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  img: { width: W, height: H },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  count: { color: '#fff', fontSize: 13, fontWeight: '500' },
  closeBtn: { padding: 4 },
  nav: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  openText: { fontWeight: '600', color: '#000' },
});
