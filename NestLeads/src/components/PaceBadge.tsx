import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { dashboardAPI } from '../services/api';

type Tone = 'green' | 'amber' | 'red';
interface Metric {
  key: string;
  label: string;
  done: number;
  target: number;
  tone: Tone;
}

const LOOK: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: '#16a34a', fg: '#fff' },
  amber: { bg: '#f59e0b', fg: '#000' },
  red: { bg: '#dc2626', fg: '#fff' },
};

const SHORT: Record<string, string> = {
  calls: 'Calls',
  conversations: 'Convos',
  quotations: 'Quotes',
  visits: 'Visits',
};

/** Staff-only: one badge per target (calls, conversations, quotations, visits), coloured by progress. */
export default function PaceBadge() {
  const [metrics, setMetrics] = useState<Metric[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await dashboardAPI.getMyPace();
      setMetrics(r.data?.configured ? r.data.metrics || [] : []);
    } catch {
      // quiet: it refreshes again shortly
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  if (!metrics.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      style={s.scroll}
    >
      {metrics.map(m => (
        <View key={m.key} style={[s.badge, { backgroundColor: LOOK[m.tone].bg }]}>
          <Text style={[s.label, { color: LOOK[m.tone].fg }]}>
            {m.tone === 'green' ? '✓ ' : ''}
            {SHORT[m.key] ?? m.label}
          </Text>
          <Text style={[s.count, { color: LOOK[m.tone].fg }]}>
            {m.done}/{m.target}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { marginTop: 8, flexGrow: 0 },
  row: { gap: 8, paddingRight: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  count: { fontSize: 12, fontWeight: '800' },
});
