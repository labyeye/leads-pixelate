import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from '../components/Icon';
import { documentFileUrl, documentsAPI, VaultDocument } from '../services/api';

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'brochure', label: 'Brochure' },
  { key: 'catalogue', label: 'Catalogue' },
  { key: 'price_list', label: 'Price list' },
  { key: 'presentation', label: 'Presentation' },
  { key: 'other', label: 'Other' },
];
const catLabel = (k: string) => CATEGORIES.find(c => c.key === k)?.label || 'Other';

const sizeOf = (n: number) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

const iconFor = (mime = '') =>
  mime.includes('pdf') ? 'document-text-outline' : mime.startsWith('image') ? 'image-outline' : 'document-outline';

// Brochures / catalogues kept ready to send to clients on WhatsApp (same vault as the web app).
export default function DocumentVaultScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<{ doc?: VaultDocument; file?: any; name: string; category: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const r = await documentsAPI.getAll();
      setDocs(r.data || []);
    } catch (e: any) {
      Alert.alert("Couldn't load documents", e?.message || '');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pick = async () => {
    const r = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 1, quality: 1 });
    const a = r.assets?.[0];
    if (!a?.uri) return;
    const fileName = a.fileName || `file-${Date.now()}`;
    setEdit({
      file: { uri: a.uri, name: fileName, type: a.type || 'application/octet-stream' },
      name: fileName.replace(/\.[^.]+$/, ''),
      category: 'other',
    });
  };

  const save = async () => {
    if (!edit || !edit.name.trim()) {
      Alert.alert('Name is required');
      return;
    }
    try {
      setSaving(true);
      if (edit.doc) await documentsAPI.update(edit.doc._id, { name: edit.name.trim(), category: edit.category });
      else if (edit.file)
        await documentsAPI.upload(edit.file.uri, edit.file.name, edit.file.type, edit.name.trim(), edit.category);
      setEdit(null);
      await load();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || '');
    } finally {
      setSaving(false);
    }
  };

  const remove = (d: VaultDocument) =>
    Alert.alert('Delete document', `Delete "${d.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await documentsAPI.remove(d._id);
            load();
          } catch (e: any) {
            Alert.alert("Couldn't delete", e?.message || '');
          }
        },
      },
    ]);

  const shown = docs.filter(
    d =>
      (filter === 'all' || d.category === filter) &&
      (!q.trim() || d.name.toLowerCase().includes(q.trim().toLowerCase())),
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 4 }}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={s.title}>Document Vault</Text>
        <TouchableOpacity style={s.addBtn} onPress={pick}>
          <Icon name="add" size={16} color="#fff" />
          <Text style={s.addText}>Upload</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchBox}>
        <Icon name="search-outline" size={14} color="#000" />
        <TextInput
          style={s.searchInput}
          placeholder="Search documents..."
          placeholderTextColor="#64748b"
          value={q}
          onChangeText={setQ}
        />
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {[{ key: 'all', label: 'All' }, ...CATEGORIES].map(c => (
            <TouchableOpacity
              key={c.key}
              style={[s.chip, filter === c.key && s.chipOn]}
              onPress={() => setFilter(c.key)}
            >
              <Text style={[s.chipText, filter === c.key && { color: '#fff' }]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#024BAB" />
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={d => d._id}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#024BAB" />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Icon name="folder-open-outline" size={36} color="#94a3b8" />
              <Text style={s.emptyTitle}>No documents</Text>
              <Text style={s.emptySub}>Upload brochures or catalogues to send on WhatsApp.</Text>
            </View>
          }
          renderItem={({ item: d }) => (
            <View style={s.card}>
              <TouchableOpacity style={s.cardMain} onPress={() => Linking.openURL(documentFileUrl(d))}>
                <View style={s.fileIcon}>
                  <Icon name={iconFor(d.mimeType)} size={20} color="#024BAB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>
                    {d.name}
                  </Text>
                  <Text style={s.meta} numberOfLines={1}>
                    {catLabel(d.category)} · {sizeOf(d.size)} ·{' '}
                    {new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity hitSlop={8} style={s.iconBtn} onPress={() => setEdit({ doc: d, name: d.name, category: d.category })}>
                <Icon name="pencil-outline" size={16} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity hitSlop={8} style={s.iconBtn} onPress={() => remove(d)}>
                <Icon name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal visible={!!edit} transparent animationType="slide" onRequestClose={() => setEdit(null)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{edit?.doc ? 'Edit document' : 'Upload document'}</Text>
            <Text style={s.label}>NAME</Text>
            <TextInput
              style={s.input}
              value={edit?.name || ''}
              onChangeText={v => setEdit(e => (e ? { ...e, name: v } : e))}
              maxLength={160}
            />
            <Text style={s.label}>CATEGORY</Text>
            <View style={s.catWrap}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.key}
                  style={[s.chip, edit?.category === c.key && s.chipOn]}
                  onPress={() => setEdit(e => (e ? { ...e, category: c.key } : e))}
                >
                  <Text style={[s.chipText, edit?.category === c.key && { color: '#fff' }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#fff' }]} onPress={() => setEdit(null)}>
                <Text style={{ fontWeight: '500', color: '#000' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#FF751F' }]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '500', color: '#fff' }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const border = { borderWidth: 2, borderColor: '#000', borderRadius: 8 } as const;
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  title: { flex: 1, fontSize: 18, fontWeight: '500', color: '#000' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#024BAB', paddingHorizontal: 10, paddingVertical: 6, ...border },
  addText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 6, margin: 12, marginBottom: 6, paddingHorizontal: 10, ...border },
  searchInput: { flex: 1, paddingVertical: 8, fontSize: 14, color: '#000' },
  chips: { paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff', ...border },
  chipOn: { backgroundColor: '#024BAB' },
  chipText: { fontSize: 12, fontWeight: '500', color: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '500', color: '#000' },
  emptySub: { fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: 30 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#fff', borderRightWidth: 4, borderBottomWidth: 4, ...border },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileIcon: { width: 38, height: 38, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', ...border },
  name: { fontSize: 14, fontWeight: '500', color: '#000' },
  meta: { fontSize: 12, color: '#64748b', marginTop: 1 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', ...border },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopWidth: 2, borderColor: '#000', padding: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '500', color: '#000', marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '500', color: '#64748b', letterSpacing: 1, marginBottom: 6 },
  input: { padding: 10, fontSize: 14, color: '#000', marginBottom: 14, ...border },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  btn: { flex: 1, paddingVertical: 12, alignItems: 'center', ...border },
});
