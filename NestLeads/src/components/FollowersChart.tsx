import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';

const H = 110;

/** Daily new-followers bars: blue for gains, red for net losses. */
export default function FollowersChart({
  data,
  width,
}: {
  data: { date: string; gained: number }[];
  width: number;
}) {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    grow.setValue(0);
    Animated.timing(grow, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [data, grow]);

  const max = Math.max(...data.map(d => d.gained), 0);
  const min = Math.min(...data.map(d => d.gained), 0);
  const span = Math.max(max - min, 1);
  const zeroY = (max / span) * H; // distance from top to the zero line
  const slot = width / Math.max(data.length, 1);
  const barW = Math.max(Math.min(slot * 0.7, 14), 1.5);
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const mid = data[Math.floor(data.length / 2)];

  return (
    <View style={{ width }}>
      <View style={{ height: H, flexDirection: 'row' }}>
        {data.map((d, i) => {
          const h = Math.max((Math.abs(d.gained) / span) * H, d.gained ? 2 : 1);
          return (
            <View key={d.date + i} style={{ width: slot, height: H, alignItems: 'center' }}>
              <Animated.View
                style={{
                  position: 'absolute',
                  width: barW,
                  backgroundColor: d.gained < 0 ? '#dc2626' : '#024BAB',
                  opacity: d.gained === 0 ? 0.25 : 1,
                  height: grow.interpolate({ inputRange: [0, 1], outputRange: [0, h] }),
                  ...(d.gained < 0 ? { top: zeroY } : { bottom: H - zeroY }),
                }}
              />
            </View>
          );
        })}
        <View style={[s.zero, { top: zeroY }]} />
      </View>
      {data.length > 0 && (
        <View style={s.labels}>
          <Text style={s.label}>{fmt(data[0].date)}</Text>
          <Text style={s.label}>{mid ? fmt(mid.date) : ''}</Text>
          <Text style={s.label}>{fmt(data[data.length - 1].date)}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  zero: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#000' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label: { fontSize: 10, fontWeight: '500', color: '#000' },
});
