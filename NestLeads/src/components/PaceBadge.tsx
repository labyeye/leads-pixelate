import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { dashboardAPI } from '../services/api';

type Tone = 'green' | 'amber' | 'red';
interface Metric {
  key: string;
  label: string;
  done: number;
  target: number;
  perMinutes: number;
  pct: number;
  tone: Tone;
}

const LOOK: Record<Tone, { label: string; bg: string; fg: string }> = {
  green: { label: 'On target', bg: '#16a34a', fg: '#fff' },
  amber: { label: 'Behind', bg: '#f59e0b', fg: '#000' },
  red: { label: 'Off pace', bg: '#dc2626', fg: '#fff' },
};

const per = (m: number) =>
  m === 60 ? 'hour' : m === 1440 ? 'day' : m === 10080 ? 'week' : m % 60 === 0 ? `${m / 60} hrs` : `${m} min`;

/** Staff-only chip in the header: my progress on every target the admin set. Tap for the list. */
export default function PaceBadge() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [tone, setTone] = useState<Tone | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await dashboardAPI.getMyPace();
      if (r.data?.configured) {
        setMetrics(r.data.metrics || []);
        setTone(r.data.tone);
      } else {
        setTone(null);
      }
    } catch {
      // quiet: it refreshes again shortly
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  if (!tone || !metrics.length) return null;
  const look = LOOK[tone];
  const hit = metrics.filter(m => m.tone === 'green').length;

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          load();
          setOpen(true);
        }}
        style={[s.chip, { backgroundColor: look.bg }]}
        activeOpacity={0.8}
      >
        <Text style={[s.chipText, { color: look.fg }]}>
          {look.label} {hit}/{metrics.length}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={s.card}>
            <Text style={s.cardTitle}>My targets</Text>
            {metrics.map(m => (
              <View key={m.key} style={s.row}>
                <View style={s.rowTop}>
                  <Text style={s.label}>{m.label}</Text>
                  <Text style={[s.value, { color: LOOK[m.tone].bg }]}>
                    {m.done} / {m.target} · {LOOK[m.tone].label}
                  </Text>
                </View>
                <View style={s.track}>
                  <View
                    style={{
                      width: `${Math.min(100, m.pct)}%`,
                      height: '100%',
                      backgroundColor: LOOK[m.tone].bg,
                    }}
                  />
                </View>
                <Text style={s.sub}>
                  target {m.target} per {per(m.perMinutes)}
                  {m.target > m.done ? ` · ${m.target - m.done} to go` : ''}
                </Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  chip: {
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    paddingTop: 90,
    paddingHorizontal: 16,
  },
  card: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 14 },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#000',
    marginBottom: 8,
  },
  row: { marginBottom: 12 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontSize: 14, fontWeight: '600', color: '#000' },
  value: { fontSize: 12, fontWeight: '700' },
  track: {
    height: 8,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#f1f5f9',
    marginTop: 4,
  },
  sub: { fontSize: 10, color: '#64748b', marginTop: 2 },
});
