import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { dashboardAPI } from '../services/api';
import { CountUp } from './motion';
import mapPaths from '../assets/mapPaths.json';

type Row = { name: string; leads: number; won: number; rate: number };

const PRIMARY = '#024BAB';
const GREEN = '#00A86B';
const SCALES = { leads: ['#EAF1FB', PRIMARY], won: ['#E6F7EF', GREEN] } as const;

const mix = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
};

/** India / world map of where leads come from and where they convert. */
export default function LeadsGeoMap({ width }: { width: number }) {
  const [geo, setGeo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'india' | 'world'>('india');
  const [metric, setMetric] = useState<'leads' | 'won'>('leads');
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    dashboardAPI
      .getGeo()
      .then(r => r?.success && setGeo(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const rows: Row[] = useMemo(
    () => (view === 'india' ? geo?.states : geo?.countries) || [],
    [geo, view],
  );
  const byName = useMemo(() => new Map(rows.map(r => [r.name, r])), [rows]);
  const max = Math.max(1, ...rows.map(r => r[metric]));
  const map = (mapPaths as any)[view] as { w: number; h: number; regions: { id: string; d: string }[] };
  const height = (width * map.h) / map.w;
  const [c0, c1] = SCALES[metric];

  const totalLeads = rows.reduce((a, r) => a + r.leads, 0);
  const minSample = Math.max(5, Math.round(totalLeads * 0.01));
  const best = [...rows]
    .filter(r => r.leads >= minSample && r.won > 0)
    .sort((a, b) => b.rate - a.rate || b.won - a.won)[0];
  const list = [...rows].sort((a, b) => b[metric] - a[metric] || b.leads - a.leads).slice(0, 5);
  const sel = picked ? byName.get(picked) : undefined;

  const fillOf = (name: string) => {
    const r = byName.get(name);
    const v = r ? r[metric] : 0;
    if (!v) return '#F3F4F6';
    return mix(c0, c1, 0.15 + 0.85 * Math.sqrt(v / max));
  };

  return (
    <View>
      <View style={s.toggles}>
        <Seg
          value={view}
          onChange={v => {
            setView(v as any);
            setPicked(null);
          }}
          options={[
            ['india', 'India'],
            ['world', 'World'],
          ]}
        />
        <Seg
          value={metric}
          onChange={v => setMetric(v as any)}
          options={[
            ['leads', 'Leads'],
            ['won', 'Won'],
          ]}
        />
      </View>

      {loading ? (
        <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : (
        <>
          <Svg width={width} height={height} viewBox={`0 0 ${map.w} ${map.h}`}>
            {map.regions.map(r => (
              <Path
                key={r.id}
                d={r.d}
                fill={fillOf(r.id)}
                stroke="#000"
                strokeWidth={picked === r.id ? 2 : view === 'india' ? 0.7 : 0.4}
                onPress={() => setPicked(p => (p === r.id ? null : r.id))}
              />
            ))}
          </Svg>

          <View style={s.infoBox}>
            {picked ? (
              <>
                <Text style={s.infoName}>{picked}</Text>
                <Text style={s.infoSub}>
                  {sel
                    ? `${sel.leads.toLocaleString('en-IN')} leads · ${sel.won} won · ${sel.rate}%`
                    : 'No leads'}
                </Text>
              </>
            ) : (
              <Text style={s.infoSub}>Tap a {view === 'india' ? 'state' : 'country'} to see its numbers</Text>
            )}
          </View>

          <View style={s.miniRow}>
            <View style={s.mini}>
              <Text style={s.miniLabel}>MOST LEADS</Text>
              <Text style={s.miniVal} numberOfLines={1}>{rows[0]?.name || '—'}</Text>
              <Text style={s.miniSub}>{rows[0] ? `${rows[0].leads.toLocaleString('en-IN')} leads` : ''}</Text>
            </View>
            <View style={s.mini}>
              <Text style={s.miniLabel}>BEST CONVERTING</Text>
              <Text style={[s.miniVal, { color: GREEN }]} numberOfLines={1}>{best?.name || '—'}</Text>
              <Text style={s.miniSub}>{best ? `${best.rate}% · ${best.won} won` : 'No wins yet'}</Text>
            </View>
          </View>

          {list.map(r => (
            <TouchableOpacity
              key={r.name}
              style={[s.row, picked === r.name && s.rowOn]}
              onPress={() => setPicked(p => (p === r.name ? null : r.name))}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.rowName} numberOfLines={1}>{r.name}</Text>
                <View style={s.track}>
                  <View style={[s.fill, { width: `${Math.max((r[metric] / max) * 100, 2)}%` as any, backgroundColor: c1 }]} />
                </View>
              </View>
              <CountUp value={r.leads} locale style={s.rowNum} />
              <CountUp value={r.won} style={[s.rowNum, { color: GREEN, width: 36 }]} />
              <Text style={s.rowRate}>{r.rate}%</Text>
            </TouchableOpacity>
          ))}
          {!!(view === 'india' ? geo?.unknownState : geo?.unknownCountry) && (
            <Text style={[s.miniSub, { marginTop: 8 }]}>
              {(view === 'india' ? geo.unknownState : geo.unknownCountry).toLocaleString('en-IN')} leads have no{' '}
              {view === 'india' ? 'state' : 'country code'}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

function Seg({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <View style={s.seg}>
      {options.map(([k, label]) => (
        <TouchableOpacity
          key={k}
          onPress={() => onChange(k)}
          style={[s.segBtn, value === k && s.segOn]}
        >
          <Text style={[s.segText, value === k && { color: '#fff' }]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  toggles: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  seg: { flexDirection: 'row', borderWidth: 2, borderColor: '#000' },
  segBtn: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#fff' },
  segOn: { backgroundColor: PRIMARY },
  segText: { fontSize: 12, fontWeight: '500', color: '#000' },
  infoBox: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 },
  infoName: { fontSize: 14, fontWeight: '600', color: '#000' },
  infoSub: { fontSize: 12, color: '#64748b' },
  miniRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 6 },
  mini: { flex: 1, borderWidth: 2, borderColor: '#000', padding: 8 },
  miniLabel: { fontSize: 9, fontWeight: '600', color: '#64748b', letterSpacing: 0.5 },
  miniVal: { fontSize: 14, fontWeight: '600', color: '#000', marginTop: 2 },
  miniSub: { fontSize: 11, color: '#64748b' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  rowOn: { backgroundColor: '#024BAB10' },
  rowName: { fontSize: 13, fontWeight: '500', color: '#000' },
  track: { height: 5, backgroundColor: '#f1f5f9', marginTop: 4 },
  fill: { height: '100%' },
  rowNum: { width: 48, textAlign: 'right', fontSize: 13, fontWeight: '600', color: '#000' },
  rowRate: { width: 42, textAlign: 'right', fontSize: 12, color: '#64748b' },
});
