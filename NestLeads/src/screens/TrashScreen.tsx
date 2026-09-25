import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, FlatList, StyleSheet, StatusBar, ActivityIndicator, RefreshControl, Alert} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {useAuth} from '../contexts/AuthContext';
import {trashAPI} from '../services/api';

export default function TrashScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const {user} = useAuth();
  const isAdmin = ['admin', 'super_admin'].includes(user?.role);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await trashAPI.list();
      setItems(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [load, isAdmin]);

  const act = async (kind: 'restore' | 'purge', item: any) => {
    try {
      await (kind === 'restore' ? trashAPI.restore(item.type, item._id) : trashAPI.purge(item.type, item._id));
      setItems(l => l.filter(x => x._id !== item._id));
    } catch (e: any) {
      Alert.alert('Action failed', e.message);
    }
  };

  const confirmPurge = (item: any) =>
    Alert.alert('Delete forever', `Permanently delete "${item.title}"? This cannot be undone.`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: () => act('purge', item)},
    ]);

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trash</Text>
      </View>
      <View style={styles.divider} />

      {!isAdmin ? (
        <View style={styles.centerBox}>
          <Icon name="lock-closed-outline" size={28} color="#94a3b8" />
          <Text style={styles.muted}>Admins only</Text>
        </View>
      ) : loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color="#22c55e" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => `${i.type}-${i._id}`}
          contentContainerStyle={{padding: 12, paddingBottom: insets.bottom + 24}}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={<Text style={[styles.muted, {textAlign: 'center', marginTop: 40}]}>Trash is empty.</Text>}
          renderItem={({item}) => (
            <View style={styles.card}>
              <Text style={styles.type}>{item.label}</Text>
              <Text style={styles.title}>{item.title}</Text>
              {!!item.sub && <Text style={styles.muted}>{item.sub}</Text>}
              <Text style={styles.muted}>
                {new Date(item.deletedAt).toLocaleString('en-IN')}
                {item.deletedBy?.name ? ` · by ${item.deletedBy.name}` : ''}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.btn} onPress={() => act('restore', item)}>
                  <Icon name="refresh" size={13} color="#000" />
                  <Text style={styles.btnText}>Restore</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, {borderColor: '#000'}]} onPress={() => confirmPurge(item)}>
                  <Icon name="trash-outline" size={13} color="#dc2626" />
                  <Text style={[styles.btnText, {color: '#dc2626'}]}>Delete forever</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, backgroundColor: '#fff'},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {flex: 1, fontSize: 17, fontWeight: '600', color: '#000'},
  divider: {height: 2, backgroundColor: '#000'},
  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8},
  muted: {fontSize: 12, color: '#64748b'},
  card: {borderWidth: 2, borderColor: '#000', padding: 12, marginBottom: 10, gap: 3},
  type: {fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1},
  title: {fontSize: 15, fontWeight: '800', color: '#000'},
  actions: {flexDirection: 'row', gap: 8, marginTop: 8},
  btn: {flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 7},
  btnText: {fontSize: 11, fontWeight: '600', color: '#000', textTransform: 'uppercase'},
});
