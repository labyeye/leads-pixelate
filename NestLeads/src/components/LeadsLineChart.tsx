import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text } from 'react-native';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const H = 120;
const PAD = 14;

/** Animated line graph: line draws itself left→right, area fades in. */
export default function LeadsLineChart({
  data,
  width,
  color = '#024BAB',
}: {
  data: { label: string; value: number }[];
  width: number;
  color?: string;
}) {
  const draw = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    draw.setValue(0);
    Animated.timing(draw, {
      toValue: 1,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [data, draw]);

  const max = Math.max(...data.map(d => d.value), 1);
  const step = (width - PAD * 2) / Math.max(data.length - 1, 1);
  const pts = data.map((d, i) => [
    PAD + i * step,
    H - PAD - (d.value / max) * (H - PAD * 2),
  ]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`;
  const len =
    pts.reduce(
      (a, p, i) =>
        i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0,
      0,
    ) + 1;

  return (
    <View>
      <Svg width={width} height={H}>
        <Defs>
          <LinearGradient id="leadsArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.25" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <AnimatedPath d={area} fill="url(#leadsArea)" opacity={draw} />
        <AnimatedPath
          d={line}
          stroke={color}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${len}`}
          strokeDashoffset={draw.interpolate({
            inputRange: [0, 1],
            outputRange: [len, 0],
          })}
        />
        {pts.map((p, i) => (
          <Circle
            key={i}
            cx={p[0]}
            cy={p[1]}
            r={3.5}
            fill="#fff"
            stroke={color}
            strokeWidth={2}
          />
        ))}
      </Svg>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: PAD - 14,
        }}
      >
        {data.map((d, i) => (
          <View key={i} style={{ alignItems: 'center', minWidth: 28 }}>
            <Text style={{ fontSize: 10, fontWeight: '500', color: '#000' }}>
              {d.value}
            </Text>
            <Text style={{ fontSize: 9, color: '#64748b' }}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
