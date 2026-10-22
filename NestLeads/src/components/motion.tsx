import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

/** Slides + fades its child in from the right on mount. */
export function SlideIn({
  delay = 0,
  children,
  style,
}: {
  delay?: number;
  children: React.ReactNode;
  style?: any;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 450,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            {
              translateX: v.interpolate({
                inputRange: [0, 1],
                outputRange: [60, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Counts from 0 up to `value` (re-runs when value changes). */
export function CountUp({
  value,
  style,
  duration = 900,
  delay = 0,
}: {
  value: number;
  style?: any;
  duration?: number;
  delay?: number;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const v = new Animated.Value(0);
    const id = v.addListener(({ value: x }) => setN(Math.round(x)));
    Animated.timing(v, {
      toValue: Number(value) || 0,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => v.removeListener(id);
  }, [value, duration, delay]);
  return <Animated.Text style={style}>{n}</Animated.Text>;
}

/** Springs its child up/larger when the tab is focused. */
export function TabBounce({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  const v = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(v, {
      toValue: focused ? 1 : 0,
      friction: 6,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [focused, v]);
  return (
    <Animated.View
      style={{
        transform: [
          {
            translateY: v.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -3],
            }),
          },
          {
            scale: v.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.15],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
