import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  Linking,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import ScreenHeader from '../components/ScreenHeader';
import DateTimeField from '../components/DateTimeField';
import MediaUploadField from '../components/MediaUploadField';
import FieldLabel from '../components/FieldLabel';
import { socialAPI, socialPlanAPI, usersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const PRIMARY = '#024BAB';
const PLATFORMS = ['instagram', 'facebook', 'linkedin'];
const TYPES = ['image', 'carousel', 'reel'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
// Plans store the day as UTC midnight; read the calendar day back without a timezone shift.
const dayKey = (iso: string) => iso.slice(0, 10);
const toDate = (day: string, time: string) => new Date(`${day}T${time}:00`);

const STATUS: Record<string, { bg: string; text: string; label: string }> = {
  PLANNED: { bg: '#e2e8f0', text: '#000', label: 'Planned' },
  PENDING_APPROVAL: { bg: '#fed7aa', text: '#92400e', label: 'Needs approval' },
  APPROVED: { bg: '#dbeafe', text: '#1e40af', label: 'Approved' },
  REJECTED: { bg: '#fee2e2', text: '#991b1b', label: 'Rejected' },
  SCHEDULED: { bg: '#ede9fe', text: '#5b21b6', label: 'Scheduled' },
};

function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, on && s.chipOn]}>
      <Text style={[s.chipText, on && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Btn({
  label,
  onPress,
  primary,
  danger,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        s.btn,
        primary && { backgroundColor: PRIMARY },
        danger && { backgroundColor: '#fee2e2' },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[s.btnText, primary && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Create / edit / review ──────────────────────────────────────────────────
function PlanModal({
  plan,
  defaultDay,
  users,
  isAdmin,
  onClose,
  onChanged,
  onSchedule,
}: {
  plan: any | null;
  defaultDay: Date;
  users: any[];
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
  onSchedule: (p: any) => void;
}) {
  const locked = !!plan && ['PENDING_APPROVAL', 'SCHEDULED'].includes(plan.status);
  const [title, setTitle] = useState(plan?.title || '');
  const [brief, setBrief] = useState(plan?.brief || '');
  const [platforms, setPlatforms] = useState<string[]>(plan?.platforms || []);
  const [postType, setPostType] = useState(plan?.postType || 'image');
  const [when, setWhen] = useState<Date>(
    plan ? toDate(dayKey(plan.plannedDate), plan.plannedTime) : defaultDay,
  );
  const [refs, setRefs] = useState<{ label: string; url: string }[]>(
    plan?.references?.length ? plan.references : [{ label: '', url: '' }],
  );
  const [refNotes, setRefNotes] = useState(plan?.referenceNotes || '');
  const [assignedTo, setAssignedTo] = useState<string>(plan?.assignedTo?._id || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<any>, done?: () => void) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
      (done || onClose)();
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = (andSubmit: boolean) => {
    if (!title.trim()) return Alert.alert('Topic is required');
    const payload = {
      title: title.trim(),
      brief,
      platforms,
      postType,
      plannedDate: ymd(when),
      plannedTime: hm(when),
      references: refs,
      referenceNotes: refNotes,
      assignedTo,
    };
    run(async () => {
      const res = plan
        ? await socialPlanAPI.update(plan._id, payload)
        : await socialPlanAPI.create(payload);
      if (andSubmit) await socialPlanAPI.submit(res.data._id);
    });
  };

  const toggle = (p: string) =>
    setPlatforms(v => (v.includes(p) ? v.filter(x => x !== p) : [...v, p]));
  const setRef = (i: number, k: 'label' | 'url', v: string) =>
    setRefs(r => r.map((x, n) => (n === i ? { ...x, [k]: v } : x)));

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={s.modal}>
        <ScreenHeader
          icon="clipboard-outline"
          title={plan ? 'Plan' : 'New plan'}
          onBack={onClose}
        />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          {plan && (
            <View style={[s.badge, { backgroundColor: STATUS[plan.status].bg, alignSelf: 'flex-start' }]}>
              <Text style={[s.badgeText, { color: STATUS[plan.status].text }]}>
                {STATUS[plan.status].label}
              </Text>
            </View>
          )}
          {plan?.status === 'REJECTED' && !!plan.rejectionReason && (
            <Text style={s.alertRed}>Rejected: {plan.rejectionReason}</Text>
          )}
          {!!plan?.approvalNote && plan.status !== 'PLANNED' && (
            <Text style={s.alertGreen}>Approval note: {plan.approvalNote}</Text>
          )}

          <View pointerEvents={locked ? 'none' : 'auto'} style={{ gap: 12, opacity: locked ? 0.6 : 1 }}>
            <View>
              <FieldLabel>Topic</FieldLabel>
              <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="e.g. Diwali offer teaser" />
            </View>
            <View>
              <FieldLabel>Date & time</FieldLabel>
              <DateTimeField value={when} onChange={setWhen} />
            </View>
            <View>
              <FieldLabel>Platforms</FieldLabel>
              <View style={s.row}>
                {PLATFORMS.map(p => (
                  <Chip key={p} label={p} on={platforms.includes(p)} onPress={() => toggle(p)} />
                ))}
              </View>
            </View>
            <View>
              <FieldLabel>Format</FieldLabel>
              <View style={s.row}>
                {TYPES.map(t => (
                  <Chip key={t} label={t} on={postType === t} onPress={() => setPostType(t)} />
                ))}
              </View>
            </View>
            <View>
              <FieldLabel>Brief / idea</FieldLabel>
              <TextInput style={[s.input, { height: 80 }]} multiline value={brief} onChangeText={setBrief} placeholder="What should this post say or show?" />
            </View>
            <View>
              <FieldLabel>Reference</FieldLabel>
              {refs.map((r, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                  <TextInput style={[s.input, { flex: 1 }]} value={r.label} onChangeText={v => setRef(i, 'label', v)} placeholder="Label" />
                  <TextInput style={[s.input, { flex: 2 }]} value={r.url} autoCapitalize="none" keyboardType="url" onChangeText={v => setRef(i, 'url', v)} placeholder="https://…" />
                  <TouchableOpacity onPress={() => setRefs(x => x.filter((_, n) => n !== i))} style={{ justifyContent: 'center' }}>
                    <Icon name="close" size={20} color="#000" />
                  </TouchableOpacity>
                </View>
              ))}
              <Btn label="+ Add link" onPress={() => setRefs(r => [...r, { label: '', url: '' }])} />
            </View>
            <View>
              <FieldLabel>Reference notes</FieldLabel>
              <TextInput style={[s.input, { height: 60 }]} multiline value={refNotes} onChangeText={setRefNotes} placeholder="What to copy or avoid" />
            </View>
            <View>
              <FieldLabel>Owner</FieldLabel>
              <View style={s.row}>
                <Chip label="Unassigned" on={!assignedTo} onPress={() => setAssignedTo('')} />
                {users.map(u => (
                  <Chip key={u._id} label={u.name} on={assignedTo === u._id} onPress={() => setAssignedTo(u._id)} />
                ))}
              </View>
            </View>
          </View>

          {plan?.status === 'PENDING_APPROVAL' && isAdmin && (
            <View>
              <FieldLabel>Note / rejection reason</FieldLabel>
              <TextInput style={s.input} value={note} onChangeText={setNote} placeholder="Optional" />
            </View>
          )}

          <View style={{ gap: 8 }}>
            {plan?.status === 'PENDING_APPROVAL' && isAdmin && (
              <View style={s.row}>
                <Btn primary disabled={busy} label="Approve" onPress={() => run(() => socialPlanAPI.approve(plan._id, note))} />
                <Btn danger disabled={busy} label="Reject" onPress={() => run(() => socialPlanAPI.reject(plan._id, note))} />
              </View>
            )}
            {plan?.status === 'APPROVED' && isAdmin && (
              <Btn primary label="Schedule post" onPress={() => onSchedule(plan)} />
            )}
            {!locked && (
              <View style={s.row}>
                <Btn disabled={busy} label="Save" onPress={() => save(false)} />
                <Btn primary disabled={busy} label="Save & send for approval" onPress={() => save(true)} />
              </View>
            )}
            {plan && plan.status !== 'SCHEDULED' && (
              <Btn
                danger
                disabled={busy}
                label="Delete plan"
                onPress={() =>
                  Alert.alert('Delete plan?', plan.title, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => run(() => socialPlanAPI.remove(plan._id)) },
                  ])
                }
              />
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Schedule an approved plan ───────────────────────────────────────────────
function ScheduleModal({
  plan,
  onClose,
  onDone,
}: {
  plan: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [caption, setCaption] = useState(plan.caption || plan.brief || '');
  const [hashtags, setHashtags] = useState((plan.hashtags || []).join(' '));
  const [when, setWhen] = useState<Date>(toDate(dayKey(plan.plannedDate), plan.plannedTime));
  const [image, setImage] = useState<string[]>([]);
  const [media, setMedia] = useState<string[]>([]);
  const [video, setVideo] = useState<string[]>([]);
  const [cover, setCover] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    socialAPI
      .getAccounts()
      .then((r: any) => {
        const active = (r.data || []).filter((a: any) => a.isActive);
        setAccounts(active);
        setAccountIds(active.filter((a: any) => plan.platforms.includes(a.platform)).map((a: any) => a._id));
      })
      .catch(() => Alert.alert('Could not load accounts'));
  }, [plan.platforms]);

  const type = plan.postType;
  const mediaOk =
    type === 'image' ? image.length > 0 : type === 'carousel' ? media.length >= 2 : video.length > 0;
  const valid = mediaOk && caption.trim() && accountIds.length > 0;

  const submit = async () => {
    setBusy(true);
    try {
      await socialPlanAPI.schedule(plan._id, {
        accountIds,
        caption: caption.trim(),
        hashtags: hashtags
          .split(/[\s,]+/)
          .filter(Boolean)
          .map((h: string) => (h.startsWith('#') ? h : `#${h}`)),
        postType: type,
        imageUrl: image[0] || '',
        mediaUrls: media,
        videoUrl: video[0] || '',
        coverImageUrl: cover[0] || '',
        scheduledAt: when.toISOString(),
      });
      Alert.alert('Post scheduled');
      onDone();
    } catch (e: any) {
      Alert.alert('Could not schedule', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={s.modal}>
        <ScreenHeader icon="paper-plane-outline" title="Schedule post" onBack={onClose} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Text style={s.cardTitle}>{plan.title}</Text>
          {!!plan.brief && <Text style={s.muted}>{plan.brief}</Text>}
          {!!plan.referenceNotes && <Text style={s.muted}>{plan.referenceNotes}</Text>}
          {plan.references?.filter((r: any) => r.url).map((r: any, i: number) => (
            <TouchableOpacity key={i} onPress={() => Linking.openURL(r.url).catch(() => {})}>
              <Text style={s.link}>{r.label || r.url}</Text>
            </TouchableOpacity>
          ))}

          <View>
            <FieldLabel>Post to</FieldLabel>
            {accounts.length === 0 ? (
              <Text style={s.muted}>No connected accounts. Connect one from the Social Planner.</Text>
            ) : (
              <View style={s.row}>
                {accounts.map(a => (
                  <Chip
                    key={a._id}
                    label={`${a.platform} · ${a.accountName}`}
                    on={accountIds.includes(a._id)}
                    onPress={() =>
                      setAccountIds(v => (v.includes(a._id) ? v.filter(x => x !== a._id) : [...v, a._id]))
                    }
                  />
                ))}
              </View>
            )}
          </View>

          {type === 'image' && <MediaUploadField kind="image" rule="feed" value={image} onChange={setImage} />}
          {type === 'carousel' && <MediaUploadField kind="image" rule="feed" multiple value={media} onChange={setMedia} />}
          {type === 'reel' && (
            <>
              <MediaUploadField kind="video" rule="reel" value={video} onChange={setVideo} />
              <MediaUploadField kind="image" value={cover} onChange={setCover} />
            </>
          )}

          <View>
            <FieldLabel>Caption</FieldLabel>
            <TextInput style={[s.input, { height: 110 }]} multiline value={caption} onChangeText={setCaption} />
          </View>
          <View>
            <FieldLabel>Hashtags</FieldLabel>
            <TextInput style={s.input} value={hashtags} autoCapitalize="none" onChangeText={setHashtags} placeholder="#offer #diwali" />
          </View>
          <View>
            <FieldLabel>Publish date & time</FieldLabel>
            <DateTimeField value={when} onChange={setWhen} />
          </View>
          <Btn primary disabled={!valid || busy} label={busy ? 'Scheduling…' : 'Schedule post'} onPress={submit} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function SocialPlanSheetScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [plans, setPlans] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const [scheduling, setScheduling] = useState<any | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      try {
        refresh ? setRefreshing(true) : setLoading(true);
        const from = new Date(Date.UTC(month.getFullYear(), month.getMonth(), 1));
        const to = new Date(Date.UTC(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59));
        const res = await socialPlanAPI.list({ from: from.toISOString(), to: to.toISOString() });
        setPlans(res.data || []);
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to load plans');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [month],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    usersAPI.getAll().then((r: any) => setUsers(r.data || [])).catch(() => {});
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter(
      p =>
        (!filter || p.status === filter) &&
        (!q || p.title.toLowerCase().includes(q) || (p.brief || '').toLowerCase().includes(q)),
    );
  }, [plans, filter, search]);

  const count = (st: string) => plans.filter(p => p.status === st).length;
  const shift = (n: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1));

  const quick = async (fn: () => Promise<any>) => {
    try {
      await fn();
      load(true);
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    }
  };

  const openRow = (p: any) => (p.status === 'APPROVED' && isAdmin ? setScheduling(p) : setEditing(p));

  const defaultDay = useMemo(() => {
    const d = new Date();
    const inMonth = d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
    const base = inMonth ? d : month;
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 0);
  }, [month]);

  const renderItem = ({ item: p }: { item: any }) => {
    const st = STATUS[p.status];
    const day = new Date(dayKey(p.plannedDate) + 'T00:00');
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => openRow(p)} style={s.card}>
        <View style={s.dateBox}>
          <Text style={s.dateDay}>{day.getDate()}</Text>
          <Text style={s.dateMon}>{day.toLocaleDateString('en-IN', { weekday: 'short' })}</Text>
          <Text style={s.dateTime}>{p.plannedTime}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.cardTitle} numberOfLines={2}>{p.title}</Text>
          <Text style={s.muted} numberOfLines={1}>
            {(p.platforms.join(', ') || 'No platform') + ' · ' + p.postType}
            {p.assignedTo?.name ? ' · ' + p.assignedTo.name : ''}
          </Text>
          {p.references?.some((r: any) => r.url) && (
            <TouchableOpacity
              onPress={() => Linking.openURL(p.references.find((r: any) => r.url).url).catch(() => {})}
              hitSlop={6}
            >
              <Text style={s.link} numberOfLines={1}>
                Reference ({p.references.filter((r: any) => r.url).length})
              </Text>
            </TouchableOpacity>
          )}
          <View style={s.row}>
            <View style={[s.badge, { backgroundColor: st.bg }]}>
              <Text style={[s.badgeText, { color: st.text }]}>{st.label}</Text>
            </View>
            {p.status === 'SCHEDULED' && p.postId && (
              <Text style={s.muted}>post: {String(p.postId.status).toLowerCase().replace('_', ' ')}</Text>
            )}
          </View>
          <View style={s.row}>
            {['PLANNED', 'REJECTED'].includes(p.status) && (
              <Btn label="Send for approval" onPress={() => quick(() => socialPlanAPI.submit(p._id))} />
            )}
            {p.status === 'PENDING_APPROVAL' && isAdmin && (
              <Btn primary label="Approve" onPress={() => quick(() => socialPlanAPI.approve(p._id))} />
            )}
            {p.status === 'APPROVED' && isAdmin && (
              <Btn primary label="Schedule" onPress={() => setScheduling(p)} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScreenHeader
        icon="clipboard-outline"
        title="Content Planner"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity onPress={() => setEditing('new')} hitSlop={8} style={{ padding: 4 }} accessibilityLabel="New plan">
            <Icon name="add" size={24} color="#000" />
          </TouchableOpacity>
        }
      />

      <View style={s.monthBar}>
        <TouchableOpacity onPress={() => shift(-1)} hitSlop={10}>
          <Icon name="chevron-back" size={22} color="#000" />
        </TouchableOpacity>
        <Text style={s.monthText}>
          {month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={() => shift(1)} hitSlop={10}>
          <Icon name="chevron-forward" size={22} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 12, gap: 8, paddingBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {Object.keys(STATUS).map(k => (
            <Chip
              key={k}
              label={`${STATUS[k].label} ${count(k)}`}
              on={filter === k}
              onPress={() => setFilter(filter === k ? '' : k)}
            />
          ))}
        </ScrollView>
        <TextInput style={s.input} value={search} onChangeText={setSearch} placeholder="Search topic or brief" />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={PRIMARY} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={p => p._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={
            <Text style={[s.muted, { textAlign: 'center', marginTop: 40 }]}>
              {plans.length ? 'No plans match.' : 'Nothing planned for this month. Tap + to add one.'}
            </Text>
          }
        />
      )}

      {editing && (
        <PlanModal
          plan={editing === 'new' ? null : editing}
          defaultDay={defaultDay}
          users={users}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
          onChanged={() => load(true)}
          onSchedule={p => {
            setEditing(null);
            setScheduling(p);
          }}
        />
      )}
      {scheduling && (
        <ScheduleModal
          plan={scheduling}
          onClose={() => setScheduling(null)}
          onDone={() => {
            setScheduling(null);
            load(true);
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  modal: { flex: 1, backgroundColor: '#f8fafc' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  monthText: { fontSize: 16, fontWeight: '600', color: '#000' },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  dateBox: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 6,
    paddingVertical: 6,
    backgroundColor: '#eff6ff',
  },
  dateDay: { fontSize: 20, fontWeight: '700', color: PRIMARY },
  dateMon: { fontSize: 11, color: '#475569' },
  dateTime: { fontSize: 11, fontWeight: '600', color: '#000', marginTop: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#000' },
  muted: { fontSize: 12, color: '#64748b' },
  link: { fontSize: 12, color: PRIMARY, textDecorationLine: 'underline' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: '#000' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: PRIMARY },
  chipText: { fontSize: 12, color: '#000', textTransform: 'capitalize' },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  btnText: { fontSize: 12, fontWeight: '600', color: '#000' },
  input: {
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#000',
    textAlignVertical: 'top',
  },
  alertRed: { backgroundColor: '#fee2e2', padding: 10, borderRadius: 6, fontSize: 13, color: '#991b1b' },
  alertGreen: { backgroundColor: '#dcfce7', padding: 10, borderRadius: 6, fontSize: 13, color: '#166534' },
});
