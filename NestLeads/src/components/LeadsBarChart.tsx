import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';

const H = 130;

/** Animated bar graph: bars grow up from the baseline, value shown above each bar. */
export default function LeadsBarChart({
  data,
  width,
  color = '#024BAB',
}: {
  data: { label: string; value: number }[];
  width: number;
  color?: string;
}) {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    grow.setValue(0);
    Animated.timing(grow, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [data, grow]);

  const max = Math.max(...data.map(d => d.value), 1);
  const slot = width / data.length;
  const barW = Math.min(28, slot * 0.55);

  return (
    <View style={{ width }}>
      <View style={[styles.plot, { height: H + 18 }]}>
        {data.map((d, i) => {
          const h = Math.max((d.value / max) * H, d.value > 0 ? 4 : 2);
          return (
            <View key={i} style={[styles.col, { width: slot }]}>
              <Text style={styles.val}>{d.value}</Text>
              <Animated.View
                style={[
                  styles.bar,
                  {
                    width: barW,
                    backgroundColor: color,
                    opacity: d.value > 0 ? 1 : 0.25,
                    height: grow.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, h],
                    }),
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.axis} />
      <View style={styles.labels}>
        {data.map((d, i) => (
          <Text key={i} style={[styles.label, { width: slot }]}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end' },
  col: { alignItems: 'center', justifyContent: 'flex-end' },
  val: { fontSize: 11, fontWeight: '500', color: '#000', marginBottom: 3 },
  bar: {
    borderWidth: 2,
    borderColor: '#000',
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  axis: { height: 2, backgroundColor: '#000' },
  labels: { flexDirection: 'row', marginTop: 6 },
  label: { textAlign: 'center', fontSize: 10, fontWeight: '500', color: '#000' },
});
