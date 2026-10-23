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

/** Fades + slides its child up on mount (same entrance as the Login screen). */
export function SlideUp({
  distance = 30,
  delay = 0,
  duration = 650,
  children,
  style,
}: {
  distance?: number;
  delay?: number;
  duration?: number;
  children: React.ReactNode;
  style?: any;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [v, delay, duration]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
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

/** HOC: wraps a whole screen in the SlideUp entrance. Call at module level. */
export function withSlideUp<T extends React.ComponentType<any>>(
  Component: T,
): T {
  const Wrapped = (props: any) => (
    <SlideUp style={{ flex: 1 }}>
      <Component {...props} />
    </SlideUp>
  );
  Wrapped.displayName = `SlideUp(${Component.displayName || Component.name})`;
  return Wrapped as unknown as T;
}

/** Counts from 0 up to `value` (re-runs when value changes). */
export function CountUp({
  value,
  style,
  duration = 900,
  delay = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  locale = false,
}: {
  value: number;
  style?: any;
  duration?: number;
  delay?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  locale?: boolean;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const v = new Animated.Value(0);
    const id = v.addListener(({ value: x }) => setN(x));
    Animated.timing(v, {
      toValue: Number(value) || 0,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => v.removeListener(id);
  }, [value, duration, delay]);
  const shown = locale
    ? n.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : n.toFixed(decimals);
  return (
    <Animated.Text style={style}>
      {prefix}
      {shown}
      {suffix}
    </Animated.Text>
  );
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

const NUM_RE = /\d[\d,]*(?:\.\d+)?/g;

/**
 * Drop-in <Text> replacement for stat values: every number inside the text
 * (e.g. "₹1,24,500", "42%", "3 / 10") counts up from 0 to its final value,
 * keeping its prefix/suffix, thousands separators and decimals.
 * Falls back to plain text when the children aren't plain strings/numbers.
 */
export function CountText({
  children,
  style,
  duration = 900,
  delay = 0,
  ...rest
}: {
  children?: React.ReactNode;
  style?: any;
  duration?: number;
  delay?: number;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
}) {
  const parts = React.Children.toArray(children);
  const plain = parts.every(c => typeof c === 'string' || typeof c === 'number');
  const text = plain ? parts.join('') : '';
  const [p, setP] = useState(0);
  useEffect(() => {
    if (!plain || !text.match(NUM_RE)) return;
    const v = new Animated.Value(0);
    const id = v.addListener(({ value }) => setP(value));
    Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => v.removeListener(id);
  }, [plain, text, duration, delay]);

  if (!plain || !text.match(NUM_RE)) {
    return (
      <Animated.Text style={style} {...rest}>
        {children}
      </Animated.Text>
    );
  }
  const out = text.replace(NUM_RE, m => {
    const decimals = m.includes('.') ? m.split('.')[1].length : 0;
    const target = parseFloat(m.replace(/,/g, ''));
    const cur = target * p;
    if (m.includes(',')) {
      return cur.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    return cur.toFixed(decimals);
  });
  return (
    <Animated.Text style={style} {...rest}>
      {out}
    </Animated.Text>
  );
}
