import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleProp, ViewStyle} from 'react-native';

interface Props {
  width?: number | string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/** Pulsing placeholder block shown while content loads. */
export default function Skeleton({width = '100%', height = 16, style}: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          backgroundColor: '#E2E8F0',
          borderWidth: 2,
          borderColor: '#000',
          borderRadius: 8,
          opacity: pulse.interpolate({inputRange: [0, 1], outputRange: [0.45, 1]}),
        },
        style,
      ]}
    />
  );
}
