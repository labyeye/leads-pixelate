import React from 'react';
import {View, StyleSheet} from 'react-native';
import Skeleton from './Skeleton';
import FadeInUp from './FadeInUp';

/** Placeholder shown while a screen's data loads — mimics a card list. */
export default function ScreenSkeleton({rows = 6}: {rows?: number}) {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading">
      <Skeleton height={44} style={styles.search} />
      {Array.from({length: rows}, (_, i) => (
        <FadeInUp key={i} delay={i * 110} duration={700}>
          <Skeleton height={84} style={styles.row} />
        </FadeInUp>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {flex: 1, padding: 14},
  search: {marginBottom: 14},
  row: {marginBottom: 12},
});
